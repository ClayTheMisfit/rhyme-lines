import 'server-only'
import { getDatabase } from '@/lib/db'
import type { Prisma } from '@/generated/prisma/client'
import { hashPassword } from './password'
import { createOneTimeToken, hashOneTimeToken } from './tokens'
import { sendAuthEmail, type AuthEmailSender } from './email'

const VERIFY_TTL_MS = 24 * 60 * 60_000
const RESET_TTL_MS = 60 * 60_000
const TOKEN_CLEANUP_INTERVAL_MS = 60 * 60_000
let lastTokenCleanupAt = 0

const isUniqueConstraintError = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
const isWriteConflict = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034'

async function serializableTransaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
  const database = getDatabase()
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await database.$transaction(operation, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (!isWriteConflict(error) || attempt === 3) throw error
    }
  }
  throw new Error('Authentication transaction did not complete')
}

export type RegistrationResult = { ok: true } | { ok: false; reason: 'duplicate' | 'email' | 'server' }

export async function registerPasswordAccount(
  input: { name: string; email: string; password: string },
  sender: AuthEmailSender = sendAuthEmail,
): Promise<RegistrationResult> {
  const passwordHash = await hashPassword(input.password)
  const { token, tokenHash } = createOneTimeToken()
  try {
    const created = await serializableTransaction(async (transaction) => {
      const existing = await transaction.user.findFirst({ where: { email: { equals: input.email, mode: 'insensitive' } }, select: { id: true } })
      if (existing) return false
      const user = await transaction.user.create({
        data: { name: input.name, email: input.email, credential: { create: { passwordHash } } },
        select: { id: true },
      })
      await transaction.authToken.create({
        data: { userId: user.id, type: 'VERIFY_EMAIL', tokenHash, expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
      })
      return true
    })
    if (!created) return { ok: false, reason: 'duplicate' }
  } catch (error) {
    if (isUniqueConstraintError(error)) return { ok: false, reason: 'duplicate' }
    console.error('[auth-signup] database operation failed')
    return { ok: false, reason: 'server' }
  }
  try {
    await sender({ kind: 'verify', to: input.email, token })
    return { ok: true }
  } catch {
    try { await getDatabase().authToken.deleteMany({ where: { tokenHash } }) } catch { console.error('[auth-token] undelivered-token cleanup failed') }
    console.error('[auth-email] verification delivery failed')
    return { ok: false, reason: 'email' }
  }
}

async function issueToken(email: string, type: 'VERIFY_EMAIL' | 'PASSWORD_RESET', sender: AuthEmailSender) {
  const database = getDatabase()
  const now = new Date()
  if (now.getTime() - lastTokenCleanupAt >= TOKEN_CLEANUP_INTERVAL_MS) {
    lastTokenCleanupAt = now.getTime()
    try { await database.authToken.deleteMany({ where: { expiresAt: { lte: now } } }) } catch { console.error('[auth-token] stale-token cleanup failed') }
  }
  const user = await database.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, emailVerified: true, credential: { select: { userId: true } } },
  })
  if (!user?.email || !user.credential) return
  if (type === 'VERIFY_EMAIL' ? user.emailVerified !== null : user.emailVerified === null) return
  const { token, tokenHash } = createOneTimeToken()
  await database.$transaction([
    // Keep other live links until this email is known to have been delivered.
    // A provider outage must not invalidate a link the user already received.
    database.authToken.deleteMany({ where: { userId: user.id, type, OR: [{ usedAt: { not: null } }, { expiresAt: { lte: now } }] } }),
    database.authToken.create({ data: { userId: user.id, type, tokenHash, expiresAt: new Date(now.getTime() + (type === 'VERIFY_EMAIL' ? VERIFY_TTL_MS : RESET_TTL_MS)) } }),
  ])
  try {
    await sender({ kind: type === 'VERIFY_EMAIL' ? 'verify' : 'reset', to: user.email, token })
  } catch (error) {
    try { await database.authToken.deleteMany({ where: { tokenHash } }) } catch { console.error('[auth-token] undelivered-token cleanup failed') }
    throw error
  }
}

export async function resendVerificationEmail(email: string, sender: AuthEmailSender = sendAuthEmail) {
  try { await issueToken(email, 'VERIFY_EMAIL', sender) } catch { console.error('[auth-email] verification delivery failed') }
}

export async function requestPasswordReset(email: string, sender: AuthEmailSender = sendAuthEmail) {
  try { await issueToken(email, 'PASSWORD_RESET', sender) } catch { console.error('[auth-email] password reset delivery failed') }
}

export async function verifyEmailToken(token: string, now = new Date()) {
  const tokenHash = hashOneTimeToken(token)
  return serializableTransaction(async (transaction) => {
    const record = await transaction.authToken.findUnique({ where: { tokenHash } })
    if (!record || record.type !== 'VERIFY_EMAIL' || record.usedAt || record.expiresAt <= now) return false
    const claimed = await transaction.authToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })
    if (claimed.count !== 1) return false
    await transaction.user.update({ where: { id: record.userId }, data: { emailVerified: now } })
    await transaction.authToken.updateMany({
      where: { userId: record.userId, type: 'VERIFY_EMAIL', usedAt: null },
      data: { usedAt: now },
    })
    return true
  })
}

export async function resetPasswordWithToken(token: string, password: string, now = new Date()) {
  const passwordHash = await hashPassword(password)
  const tokenHash = hashOneTimeToken(token)
  return serializableTransaction(async (transaction) => {
    const record = await transaction.authToken.findUnique({ where: { tokenHash } })
    if (!record || record.type !== 'PASSWORD_RESET' || record.usedAt || record.expiresAt <= now) return false
    const claimed = await transaction.authToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })
    if (claimed.count !== 1) return false
    await transaction.credential.update({ where: { userId: record.userId }, data: { passwordHash } })
    await transaction.user.update({ where: { id: record.userId }, data: { sessionVersion: { increment: 1 } } })
    await transaction.authToken.updateMany({
      where: { userId: record.userId, type: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: now },
    })
    return true
  })
}
