import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { Prisma, PrismaClient } from '../src/generated/prisma/client'
import { authRateLimitKey } from '../src/lib/auth/rate-limit-key'

const EMAIL_RATE_LIMIT_ACTIONS = ['login', 'password-reset', 'verification-resend'] as const

export type DeletionCounts = {
  user: number
  credential: number
  authAccounts: number
  sessions: number
  authTokens: number
  cloudDocuments: number
  cloudDocumentVersions: number
  legacyVerificationTokens: number
  emailRateLimits: number
}

type DeletionScope = {
  credential: string[]
  authAccounts: string[]
  sessions: string[]
  authTokens: string[]
  cloudDocuments: string[]
  cloudDocumentVersions: string[]
  legacyVerificationTokens: string[]
  emailRateLimits: string[]
}

type AccountIdentity = { id: string; email: string }

export class AccountDeletionError extends Error {
  constructor(
    readonly code:
      | 'invalid-input'
      | 'account-not-found'
      | 'ambiguous-account'
      | 'target-mismatch'
      | 'confirmation-invalid'
      | 'scope-stale'
      | 'unexpected-relationships'
      | 'transaction-failed',
  ) {
    super(code)
    this.name = 'AccountDeletionError'
  }
}

export function normalizeAccountEmail(email: string) {
  return email.trim().toLowerCase()
}

export function validateCaseId(caseId: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(caseId)
}

export function validateAccountDeletionSecret(secret: string) {
  return Buffer.byteLength(secret, 'utf8') >= 32
}

export function getDatabaseIdentity(databaseUrl: string) {
  let url: URL
  try {
    url = new URL(databaseUrl)
  } catch {
    throw new AccountDeletionError('invalid-input')
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new AccountDeletionError('invalid-input')
  }

  const query = [...url.searchParams.entries()].sort(([keyA, valueA], [keyB, valueB]) =>
    keyA.localeCompare(keyB) || valueA.localeCompare(valueB))
  const database = decodeURIComponent(url.pathname.slice(1))
  if (!database) throw new AccountDeletionError('invalid-input')
  const identity = JSON.stringify({
    protocol: url.protocol,
    host: url.hostname,
    port: url.port || '5432',
    database,
    query,
  })
  return createHash('sha256').update(identity).digest('hex')
}

function hashOpaqueIdentifier(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function sorted(values: string[]) {
  return values.sort()
}

async function collectDeletionScope(
  transaction: Prisma.TransactionClient,
  userId: string,
  email: string,
  authSecret: string,
): Promise<DeletionScope> {
  const emailRateLimitHashes = EMAIL_RATE_LIMIT_ACTIONS.map((action) =>
    authRateLimitKey(action, normalizeAccountEmail(email), authSecret))
  const [
    credential,
    authAccounts,
    sessions,
    authTokens,
    cloudDocuments,
    legacyTokens,
    emailRateLimits,
  ] = await Promise.all([
    transaction.credential.findUnique({ where: { userId }, select: { userId: true } }),
    transaction.account.findMany({ where: { userId }, select: { id: true } }),
    transaction.session.findMany({ where: { userId }, select: { id: true } }),
    transaction.authToken.findMany({ where: { userId }, select: { id: true } }),
    transaction.cloudDocument.findMany({ where: { userId }, select: { id: true } }),
    transaction.verificationToken.findMany({
      where: { identifier: { equals: email, mode: 'insensitive' } },
      select: { identifier: true, token: true },
    }),
    transaction.authRateLimit.findMany({
      where: { keyHash: { in: emailRateLimitHashes } },
      select: { keyHash: true },
    }),
  ])

  const documentIds = cloudDocuments.map(({ id }) => id)
  const relatedVersions = await transaction.cloudDocumentVersion.findMany({
    where: { OR: [{ userId }, { documentId: { in: documentIds } }] },
    select: { id: true, userId: true, documentId: true },
  })
  if (relatedVersions.some((version) => version.userId !== userId || !documentIds.includes(version.documentId))) {
    throw new AccountDeletionError('unexpected-relationships')
  }

  return {
    credential: credential ? [credential.userId] : [],
    authAccounts: sorted(authAccounts.map(({ id }) => id)),
    sessions: sorted(sessions.map(({ id }) => id)),
    authTokens: sorted(authTokens.map(({ id }) => id)),
    cloudDocuments: sorted(cloudDocuments.map(({ id }) => id)),
    cloudDocumentVersions: sorted(relatedVersions.map(({ id }) => id)),
    legacyVerificationTokens: sorted(legacyTokens.map(({ identifier, token }) =>
      hashOpaqueIdentifier(`${identifier}\0${token}`))),
    emailRateLimits: sorted(emailRateLimits.map(({ keyHash }) => keyHash)),
  }
}

function countsFor(scope: DeletionScope): DeletionCounts {
  return {
    user: 1,
    credential: scope.credential.length,
    authAccounts: scope.authAccounts.length,
    sessions: scope.sessions.length,
    authTokens: scope.authTokens.length,
    cloudDocuments: scope.cloudDocuments.length,
    cloudDocumentVersions: scope.cloudDocumentVersions.length,
    legacyVerificationTokens: scope.legacyVerificationTokens.length,
    emailRateLimits: scope.emailRateLimits.length,
  }
}

function getScopeFingerprint(scope: DeletionScope) {
  return createHash('sha256').update(JSON.stringify(scope), 'utf8').digest('hex')
}

function confirmationMac(
  details: {
    databaseIdentity: string
    caseId: string
    userId: string
    email: string
    scopeFingerprint: string
  },
  secret: string,
) {
  return createHmac('sha256', secret).update(JSON.stringify({
    version: 1,
    databaseIdentity: details.databaseIdentity,
    caseId: details.caseId,
    userId: details.userId,
    email: normalizeAccountEmail(details.email),
    scopeFingerprint: details.scopeFingerprint,
  }), 'utf8').digest('base64url')
}

function parseConfirmationArtifact(artifact: string) {
  const match = /^v1\.([a-f0-9]{64})\.([A-Za-z0-9_-]{43})$/.exec(artifact)
  if (!match) throw new AccountDeletionError('confirmation-invalid')
  return { scopeFingerprint: match[1], mac: match[2] }
}

export function createConfirmationArtifact(
  details: Parameters<typeof confirmationMac>[0],
  secret: string,
) {
  return `v1.${details.scopeFingerprint}.${confirmationMac(details, secret)}`
}

export function verifyConfirmationArtifact(
  artifact: string,
  details: Omit<Parameters<typeof confirmationMac>[0], 'scopeFingerprint'>,
  secret: string,
) {
  const parsed = parseConfirmationArtifact(artifact)
  const expected = confirmationMac({ ...details, scopeFingerprint: parsed.scopeFingerprint }, secret)
  const actualBytes = Buffer.from(parsed.mac, 'base64url')
  const expectedBytes = Buffer.from(expected, 'base64url')
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

export type AccountDeletionPreview = {
  userId: string
  counts: DeletionCounts
  confirmation: string
}

async function findAccountByEmail(database: Pick<Prisma.TransactionClient, 'user'>, email: string): Promise<AccountIdentity> {
  const matches = await database.user.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true },
    take: 2,
  })
  if (matches.length > 1) throw new AccountDeletionError('ambiguous-account')
  if (matches.length === 0 || !matches[0].email) throw new AccountDeletionError('account-not-found')
  return { id: matches[0].id, email: matches[0].email }
}

function validateCommonInputs(email: string, caseId: string, secret: string) {
  if (!email || email.length > 254 || email !== normalizeAccountEmail(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !validateCaseId(caseId) || !validateAccountDeletionSecret(secret)) {
    throw new AccountDeletionError('invalid-input')
  }
}

export async function previewAccountDeletion(
  database: PrismaClient,
  input: {
    email: string
    caseId: string
    confirmationSecret: string
    databaseIdentity: string
    authSecret: string
  },
): Promise<AccountDeletionPreview> {
  validateCommonInputs(input.email, input.caseId, input.confirmationSecret)
  if (!validateAccountDeletionSecret(input.authSecret)) throw new AccountDeletionError('invalid-input')
  return database.$transaction(async (transaction) => {
    const account = await findAccountByEmail(transaction, input.email)
    const scope = await collectDeletionScope(transaction, account.id, account.email, input.authSecret)
    const scopeFingerprint = getScopeFingerprint(scope)
    return {
      userId: account.id,
      counts: countsFor(scope),
      confirmation: createConfirmationArtifact({
        databaseIdentity: input.databaseIdentity,
        caseId: input.caseId,
        userId: account.id,
        email: account.email,
        scopeFingerprint,
      }, input.confirmationSecret),
    }
  }, { isolationLevel: 'RepeatableRead', maxWait: 10_000, timeout: 30_000 })
}

async function deleteAndVerify<T extends { count: number }>(
  operation: Promise<T>,
  expectedCount: number,
) {
  const result = await operation
  if (result.count !== expectedCount) throw new AccountDeletionError('scope-stale')
}

export async function executeAccountDeletion(
  database: PrismaClient,
  input: {
    email: string
    caseId: string
    userId: string
    confirmation: string
    confirmationSecret: string
    databaseIdentity: string
    authSecret: string
  },
): Promise<
  | { status: 'deleted'; counts: DeletionCounts }
  | { status: 'already-deleted'; counts: null }
> {
  validateCommonInputs(input.email, input.caseId, input.confirmationSecret)
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(input.userId)
    || !validateAccountDeletionSecret(input.authSecret)) {
    throw new AccountDeletionError('invalid-input')
  }
  const artifact = parseConfirmationArtifact(input.confirmation)

  try {
    return await database.$transaction(async (transaction) => {
      const users = await transaction.$queryRaw<Array<{ id: string; email: string | null }>>`
        SELECT "id", "email" FROM "User" WHERE "id" = ${input.userId} FOR UPDATE
      `
      if (users.length === 0) {
        const emailOwner = await transaction.user.findFirst({
          where: { email: { equals: input.email, mode: 'insensitive' } },
          select: { id: true },
        })
        if (emailOwner) throw new AccountDeletionError('target-mismatch')
        const valid = verifyConfirmationArtifact(input.confirmation, {
          databaseIdentity: input.databaseIdentity,
          caseId: input.caseId,
          userId: input.userId,
          email: input.email,
        }, input.confirmationSecret)
        if (!valid) throw new AccountDeletionError('confirmation-invalid')
        return { status: 'already-deleted', counts: null }
      }

      const user = users[0]
      if (!user.email || normalizeAccountEmail(user.email) !== input.email) {
        throw new AccountDeletionError('target-mismatch')
      }
      const scope = await collectDeletionScope(transaction, user.id, user.email, input.authSecret)
      const scopeFingerprint = getScopeFingerprint(scope)
      if (scopeFingerprint !== artifact.scopeFingerprint) throw new AccountDeletionError('scope-stale')
      const valid = verifyConfirmationArtifact(input.confirmation, {
        databaseIdentity: input.databaseIdentity,
        caseId: input.caseId,
        userId: user.id,
        email: user.email,
      }, input.confirmationSecret)
      if (!valid) throw new AccountDeletionError('confirmation-invalid')

      const counts = countsFor(scope)
      await deleteAndVerify(transaction.verificationToken.deleteMany({
        where: { identifier: { equals: user.email, mode: 'insensitive' } },
      }), counts.legacyVerificationTokens)
      await deleteAndVerify(transaction.authRateLimit.deleteMany({
        where: { keyHash: { in: scope.emailRateLimits } },
      }), counts.emailRateLimits)
      await deleteAndVerify(transaction.authToken.deleteMany({ where: { userId: user.id } }), counts.authTokens)
      await deleteAndVerify(transaction.session.deleteMany({ where: { userId: user.id } }), counts.sessions)
      await deleteAndVerify(transaction.account.deleteMany({ where: { userId: user.id } }), counts.authAccounts)
      await deleteAndVerify(transaction.credential.deleteMany({ where: { userId: user.id } }), counts.credential)
      await deleteAndVerify(transaction.cloudDocumentVersion.deleteMany({
        where: { userId: user.id },
      }), counts.cloudDocumentVersions)
      await deleteAndVerify(transaction.cloudDocument.deleteMany({ where: { userId: user.id } }), counts.cloudDocuments)
      const deletedUser = await transaction.user.deleteMany({ where: { id: user.id } })
      if (deletedUser.count !== 1) throw new AccountDeletionError('scope-stale')
      const remainingRecords = await Promise.all([
        transaction.user.count({ where: { id: user.id } }),
        transaction.credential.count({ where: { userId: user.id } }),
        transaction.account.count({ where: { userId: user.id } }),
        transaction.session.count({ where: { userId: user.id } }),
        transaction.authToken.count({ where: { userId: user.id } }),
        transaction.cloudDocument.count({ where: { userId: user.id } }),
        transaction.cloudDocumentVersion.count({ where: { userId: user.id } }),
        transaction.verificationToken.count({
          where: { identifier: { equals: user.email, mode: 'insensitive' } },
        }),
        transaction.authRateLimit.count({ where: { keyHash: { in: scope.emailRateLimits } } }),
      ])
      if (remainingRecords.some((count) => count !== 0)) throw new AccountDeletionError('scope-stale')
      return { status: 'deleted', counts }
    }, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 30_000 })
  } catch (error) {
    if (error instanceof AccountDeletionError) throw error
    throw new AccountDeletionError('transaction-failed')
  }
}

export function formatAccountDeletionError(error: unknown) {
  if (!(error instanceof AccountDeletionError)) return 'Operation failed; no database details were logged.'
  switch (error.code) {
    case 'invalid-input': return 'Invalid or missing deletion parameters.'
    case 'account-not-found': return 'No matching account was found.'
    case 'ambiguous-account': return 'Multiple accounts matched; stop and request manual review.'
    case 'target-mismatch': return 'The reviewed account identity no longer matches.'
    case 'confirmation-invalid': return 'The execution confirmation is invalid.'
    case 'scope-stale': return 'The account scope changed; run a new dry run.'
    case 'unexpected-relationships': return 'Unexpected record ownership links were found; stop and request manual review.'
    case 'transaction-failed': return 'The transaction did not report success; verify database state before retrying.'
    default: return 'Operation failed; no database details were logged.'
  }
}
