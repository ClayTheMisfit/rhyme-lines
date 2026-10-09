import 'server-only'
import { createHmac } from 'node:crypto'
import { getDatabase } from '@/lib/db'

export type AuthRateLimitAction = 'login' | 'login-ip' | 'signup-ip' | 'recovery' | 'recovery-ip' | 'token'

const policies: Record<AuthRateLimitAction, { limit: number; windowMs: number; blockMs: number }> = {
  login: { limit: 8, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
  'login-ip': { limit: 40, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
  'signup-ip': { limit: 5, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  recovery: { limit: 5, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  'recovery-ip': { limit: 30, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  token: { limit: 12, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
}

const STALE_ENTRY_MS = 24 * 60 * 60_000
const CLEANUP_INTERVAL_MS = 60 * 60_000
const TRANSACTION_ATTEMPTS = 3
let lastCleanupAt = 0

export function getClientAddress(request: Request) {
  const configuredHeader = process.env.AUTH_TRUSTED_PROXY_HEADER?.trim().toLowerCase()
  const header = process.env.VERCEL === '1' ? 'x-vercel-forwarded-for' : configuredHeader
  if (!header || !/^[a-z0-9-]+$/.test(header)) return null
  const value = request.headers.get(header)
  return value?.split(',', 1)[0].trim().slice(0, 128) || null
}

function rateLimitKey(action: AuthRateLimitAction, identity: string) {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is required for authentication rate limiting')
  return createHmac('sha256', secret).update(`${action}:${identity}`).digest('hex')
}

function isRetryableTransactionError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error.code === 'P2034' || error.code === 'P2002')
}

async function cleanupStaleEntries(now: Date) {
  if (now.getTime() - lastCleanupAt < CLEANUP_INTERVAL_MS) return
  lastCleanupAt = now.getTime()
  try {
    await getDatabase().authRateLimit.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - STALE_ENTRY_MS) } } })
  } catch {
    // Cleanup is best-effort and must never weaken or interrupt an auth decision.
    console.error('[auth-rate-limit] stale-entry cleanup failed')
  }
}

export async function consumeAuthRateLimit(action: AuthRateLimitAction, identity: string, now = new Date()) {
  const policy = policies[action]
  const keyHash = rateLimitKey(action, identity)
  const database = getDatabase()
  await cleanupStaleEntries(now)
  for (let attempt = 1; attempt <= TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await database.$transaction(async (transaction) => {
        const existing = await transaction.authRateLimit.findUnique({ where: { keyHash } })
        if (existing?.blockedUntil && existing.blockedUntil > now) return false
        const windowExpired = !existing || now.getTime() - existing.windowStartedAt.getTime() >= policy.windowMs
        if (windowExpired) {
          await transaction.authRateLimit.upsert({
            where: { keyHash },
            create: { keyHash, attempts: 1, windowStartedAt: now },
            update: { attempts: 1, windowStartedAt: now, blockedUntil: null },
          })
          return true
        }
        const attempts = existing.attempts + 1
        const blockedUntil = attempts > policy.limit ? new Date(now.getTime() + policy.blockMs) : null
        await transaction.authRateLimit.update({ where: { keyHash }, data: { attempts, blockedUntil } })
        return blockedUntil === null
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === TRANSACTION_ATTEMPTS) throw error
    }
  }
  throw new Error('Authentication rate-limit transaction did not complete')
}

export async function clearAuthRateLimit(action: AuthRateLimitAction, identity: string) {
  const keyHash = rateLimitKey(action, identity)
  await getDatabase().authRateLimit.deleteMany({ where: { keyHash } })
}
