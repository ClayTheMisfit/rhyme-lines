import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { authRateLimitKey } from '../src/lib/auth/rate-limit-key'
import { getSyntheticIpRateLimitIdentity } from './admin-delete-account-test-fixtures'
import {
  AccountDeletionError,
  executeAccountDeletion,
  getDatabaseIdentity,
  previewAccountDeletion,
} from './admin-delete-account-core'

const TEST_AUTH_SECRET = 'isolated-test-auth-secret-not-for-use-outside-this-script'
const TEST_CONFIRMATION_SECRET = 'isolated-test-confirmation-secret-not-for-use-outside-this-script'
const timestamp = new Date()

function getIsolatedTestUrl() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Integration tests are disabled in production mode')
  }
  const value = process.env.ACCOUNT_DELETION_TEST_DATABASE_URL
  if (!value) throw new Error('ACCOUNT_DELETION_TEST_DATABASE_URL is required')
  const url = new URL(value)
  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
  const databaseName = decodeURIComponent(url.pathname.slice(1))
  if ((url.protocol !== 'postgres:' && url.protocol !== 'postgresql:')
    || !localHosts.has(url.hostname)
    || !/test/i.test(databaseName)) {
    throw new Error('Integration tests require a loopback PostgreSQL URL with "test" in its database name')
  }
  return value
}

function makeDocument(title: string, userId: string) {
  return {
    userId,
    clientDocumentId: `local-${title}`,
    title,
    content: [{ id: `${title}-line`, text: 'SYNTHETIC_TEST_CONTENT' }],
    clientCreatedAt: timestamp,
    clientUpdatedAt: timestamp,
    position: 1,
  }
}

function expectDeletionError(action: () => Promise<unknown>, code: AccountDeletionError['code']) {
  return action().then(
    () => assert.fail(`Expected account deletion error: ${code}`),
    (error: unknown) => assert.ok(error instanceof AccountDeletionError && error.code === code),
  )
}

async function main() {
  const databaseUrl = getIsolatedTestUrl()
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 }),
  })
  const runId = randomUUID().replaceAll('-', '')
  const targetId = `delete-test-${runId}`
  const otherId = `preserve-test-${runId}`
  const rollbackId = `rollback-test-${runId}`
  const targetEmail = `target-${runId}@ExAmPlE.Test`
  const targetLookupEmail = targetEmail.toLowerCase()
  const otherEmail = `other-${runId}@example.test`
  const rollbackEmail = `rollback-${runId}@example.test`
  const caseId = `case-${runId}`
  const rateHashes = [
    authRateLimitKey('login', targetLookupEmail, TEST_AUTH_SECRET),
    authRateLimitKey('password-reset', targetLookupEmail, TEST_AUTH_SECRET),
    authRateLimitKey('verification-resend', targetLookupEmail, TEST_AUTH_SECRET),
  ]
  const ipRateHash = authRateLimitKey('login-ip', getSyntheticIpRateLimitIdentity(runId), TEST_AUTH_SECRET)
  const otherRateHash = authRateLimitKey('password-reset', otherEmail, TEST_AUTH_SECRET)
  const triggerFunction = `account_deletion_test_${runId}`
  const triggerName = `account_deletion_test_${runId}`
  const dbFingerprint = getDatabaseIdentity(databaseUrl)
  let connected = false
  let isolatedDatabaseVerified = false

  try {
    await db.$connect()
    connected = true
    const databaseMetadata = await db.$queryRaw<Array<{ databaseName: string }>>`
      SELECT current_database() AS "databaseName"
    `
    if (!databaseMetadata[0]?.databaseName.toLowerCase().includes('test')) {
      throw new Error('Could not confirm an isolated PostgreSQL test database')
    }
    isolatedDatabaseVerified = true
    await db.user.createMany({
      data: [
        { id: targetId, email: targetEmail, updatedAt: timestamp },
        { id: otherId, email: otherEmail, updatedAt: timestamp },
        { id: rollbackId, email: rollbackEmail, updatedAt: timestamp },
      ],
    })
    await db.credential.create({ data: { userId: targetId, passwordHash: 'synthetic-password-hash' } })
    await db.account.create({
      data: {
        userId: targetId,
        type: 'oauth',
        provider: 'google',
        providerAccountId: `synthetic-${runId}`,
      },
    })
    await db.session.create({
      data: { userId: targetId, sessionToken: `synthetic-session-${runId}`, expires: new Date(Date.now() + 60_000) },
    })
    await db.authToken.create({
      data: { userId: targetId, type: 'PASSWORD_RESET', tokenHash: runId.padEnd(64, '0').slice(0, 64), expiresAt: timestamp },
    })
    const targetDocumentInput = makeDocument('target-doc', targetId)
    const targetDocument = await db.cloudDocument.create({ data: targetDocumentInput })
    await db.cloudDocumentVersion.create({
      data: {
        documentId: targetDocument.id,
        userId: targetId,
        sourceRevision: 1,
        title: targetDocument.title,
        content: targetDocumentInput.content,
        lifecycle: targetDocument.lifecycle,
        isPinned: targetDocument.isPinned,
        position: targetDocument.position,
        clientCreatedAt: targetDocument.clientCreatedAt,
        clientUpdatedAt: targetDocument.clientUpdatedAt,
        reason: 'INITIAL',
      },
    })
    const otherDocumentInput = makeDocument('other-doc', otherId)
    const otherDocument = await db.cloudDocument.create({ data: otherDocumentInput })
    await db.verificationToken.createMany({
      data: [
        { identifier: targetEmail.toUpperCase(), token: `legacy-${runId}`, expires: new Date(Date.now() + 60_000) },
        { identifier: otherEmail, token: `unrelated-${runId}`, expires: new Date(Date.now() + 60_000) },
      ],
    })
    await db.authRateLimit.createMany({
      data: [
        ...rateHashes.map((keyHash) => ({ keyHash, attempts: 2, windowStartedAt: timestamp, updatedAt: timestamp })),
        { keyHash: ipRateHash, attempts: 2, windowStartedAt: timestamp, updatedAt: timestamp },
        { keyHash: otherRateHash, attempts: 2, windowStartedAt: timestamp, updatedAt: timestamp },
      ],
    })

    const previewInput = {
      email: targetLookupEmail,
      caseId,
      confirmationSecret: TEST_CONFIRMATION_SECRET,
      databaseIdentity: dbFingerprint,
      authSecret: TEST_AUTH_SECRET,
    }
    const tableCountsBeforePreview = await Promise.all([
      db.user.count(),
      db.credential.count(),
      db.account.count(),
      db.session.count(),
      db.authToken.count(),
      db.cloudDocument.count(),
      db.cloudDocumentVersion.count(),
      db.verificationToken.count(),
      db.authRateLimit.count(),
    ])
    await expectDeletionError(() => previewAccountDeletion(db, {
      ...previewInput,
      email: `missing-${runId}@example.test`,
    }), 'account-not-found')
    const firstPreview = await previewAccountDeletion(db, previewInput)
    const tableCountsAfterPreview = await Promise.all([
      db.user.count(),
      db.credential.count(),
      db.account.count(),
      db.session.count(),
      db.authToken.count(),
      db.cloudDocument.count(),
      db.cloudDocumentVersion.count(),
      db.verificationToken.count(),
      db.authRateLimit.count(),
    ])
    assert.deepEqual(tableCountsAfterPreview, tableCountsBeforePreview)
    assert.deepEqual(firstPreview.counts, {
      user: 1,
      credential: 1,
      authAccounts: 1,
      sessions: 1,
      authTokens: 1,
      cloudDocuments: 1,
      cloudDocumentVersions: 1,
      legacyVerificationTokens: 1,
      emailRateLimits: 3,
    })
    assert.equal(firstPreview.userId, targetId)
    assert.equal(await db.user.count({ where: { id: targetId } }), 1)

    const executionInput = {
      email: targetLookupEmail,
      caseId,
      userId: firstPreview.userId,
      confirmation: firstPreview.confirmation,
      confirmationSecret: TEST_CONFIRMATION_SECRET,
      databaseIdentity: dbFingerprint,
      authSecret: TEST_AUTH_SECRET,
    }
    await expectDeletionError(
      () => executeAccountDeletion(db, { ...executionInput, userId: otherId }),
      'target-mismatch',
    )
    await expectDeletionError(
      () => executeAccountDeletion(db, { ...executionInput, caseId: 'case-wrong' }),
      'confirmation-invalid',
    )
    await expectDeletionError(
      () => executeAccountDeletion(db, { ...executionInput, confirmation: 'v1.invalid.invalid' }),
      'confirmation-invalid',
    )

    await db.cloudDocument.create({ data: makeDocument('concurrent-scope-change', targetId) })
    await expectDeletionError(() => executeAccountDeletion(db, executionInput), 'scope-stale')

    const mismatchedVersion = await db.cloudDocumentVersion.create({
      data: {
        documentId: otherDocument.id,
        userId: rollbackId,
        sourceRevision: 1,
        title: otherDocument.title,
        content: otherDocumentInput.content,
        lifecycle: otherDocument.lifecycle,
        isPinned: otherDocument.isPinned,
        position: otherDocument.position,
        clientCreatedAt: otherDocument.clientCreatedAt,
        clientUpdatedAt: otherDocument.clientUpdatedAt,
        reason: 'INITIAL',
      },
    })
    await expectDeletionError(() => previewAccountDeletion(db, {
      ...previewInput,
      email: rollbackEmail,
      caseId: `${caseId}-rollback`,
    }), 'unexpected-relationships')
    await db.cloudDocumentVersion.delete({ where: { id: mismatchedVersion.id } })

    const freshPreview = await previewAccountDeletion(db, previewInput)
    const freshExecution = { ...executionInput, confirmation: freshPreview.confirmation }
    const escapedRollbackId = rollbackId.replaceAll("'", "''")
    await db.$executeRawUnsafe(`
      CREATE FUNCTION "${triggerFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD."id" = '${escapedRollbackId}' THEN RAISE EXCEPTION 'intentional isolated rollback test'; END IF;
        IF OLD."id" = '${targetId}' THEN PERFORM pg_sleep(1); END IF;
        RETURN OLD;
      END;
      $$
    `)
    await db.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE DELETE ON "User" FOR EACH ROW EXECUTE FUNCTION "${triggerFunction}"()`)

    await db.credential.create({ data: { userId: rollbackId, passwordHash: 'synthetic-rollback-hash' } })
    await db.account.create({
      data: {
        userId: rollbackId,
        type: 'oauth',
        provider: 'google',
        providerAccountId: `rollback-${runId}`,
      },
    })
    await db.session.create({
      data: {
        userId: rollbackId,
        sessionToken: `synthetic-rollback-session-${runId}`,
        expires: new Date(Date.now() + 60_000),
      },
    })
    await db.authToken.create({
      data: {
        userId: rollbackId,
        type: 'PASSWORD_RESET',
        tokenHash: `rollback${runId}`.padEnd(64, '0').slice(0, 64),
        expiresAt: timestamp,
      },
    })
    const rollbackDocumentInput = makeDocument('rollback-doc', rollbackId)
    const rollbackDocument = await db.cloudDocument.create({ data: rollbackDocumentInput })
    await db.cloudDocumentVersion.create({
      data: {
        documentId: rollbackDocument.id,
        userId: rollbackId,
        sourceRevision: 1,
        title: rollbackDocument.title,
        content: rollbackDocumentInput.content,
        lifecycle: rollbackDocument.lifecycle,
        isPinned: rollbackDocument.isPinned,
        position: rollbackDocument.position,
        clientCreatedAt: rollbackDocument.clientCreatedAt,
        clientUpdatedAt: rollbackDocument.clientUpdatedAt,
        reason: 'INITIAL',
      },
    })
    const rollbackPreview = await previewAccountDeletion(db, {
      ...previewInput,
      email: rollbackEmail,
      caseId: `${caseId}-rollback`,
    })
    await expectDeletionError(() => executeAccountDeletion(db, {
      email: rollbackEmail,
      caseId: `${caseId}-rollback`,
      userId: rollbackId,
      confirmation: rollbackPreview.confirmation,
      confirmationSecret: TEST_CONFIRMATION_SECRET,
      databaseIdentity: dbFingerprint,
      authSecret: TEST_AUTH_SECRET,
    }), 'transaction-failed')
    assert.equal(await db.user.count({ where: { id: rollbackId } }), 1)
    assert.equal(await db.credential.count({ where: { userId: rollbackId } }), 1)
    assert.equal(await db.account.count({ where: { userId: rollbackId } }), 1)
    assert.equal(await db.session.count({ where: { userId: rollbackId } }), 1)
    assert.equal(await db.authToken.count({ where: { userId: rollbackId } }), 1)
    assert.equal(await db.cloudDocument.count({ where: { id: rollbackDocument.id } }), 1)
    assert.equal(await db.cloudDocumentVersion.count({ where: { documentId: rollbackDocument.id } }), 1)

    const deletionPromise = executeAccountDeletion(db, freshExecution)
    await new Promise((resolve) => setTimeout(resolve, 100))
    const concurrentAccountPromise = db.account.create({
      data: {
        userId: targetId,
        type: 'oauth',
        provider: 'github',
        providerAccountId: `concurrent-${runId}`,
      },
    }).then(
      () => 'created' as const,
      (error: unknown) => {
        const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null
        if (code === 'P2003' || code === 'P2034') return 'blocked' as const
        throw error
      },
    )
    const [deletionResult, concurrentResult] = await Promise.all([deletionPromise, concurrentAccountPromise])
    assert.equal(deletionResult.status, 'deleted')
    assert.equal(concurrentResult, 'blocked')
    assert.equal(await db.user.count({ where: { id: targetId } }), 0)
    assert.equal(await db.credential.count({ where: { userId: targetId } }), 0)
    assert.equal(await db.account.count({ where: { userId: targetId } }), 0)
    assert.equal(await db.session.count({ where: { userId: targetId } }), 0)
    assert.equal(await db.authToken.count({ where: { userId: targetId } }), 0)
    assert.equal(await db.cloudDocument.count({ where: { userId: targetId } }), 0)
    assert.equal(await db.cloudDocumentVersion.count({ where: { userId: targetId } }), 0)
    assert.equal(await db.verificationToken.count({ where: { identifier: { equals: targetEmail, mode: 'insensitive' } } }), 0)
    assert.equal(await db.authRateLimit.count({ where: { keyHash: { in: rateHashes } } }), 0)
    assert.equal(await db.authRateLimit.count({ where: { keyHash: ipRateHash } }), 1)
    assert.equal(await db.authRateLimit.count({ where: { keyHash: otherRateHash } }), 1)
    assert.equal(await db.cloudDocument.count({ where: { id: otherDocument.id } }), 1)
    assert.equal(await db.user.count({ where: { id: otherId } }), 1)

    const secondExecution = await executeAccountDeletion(db, freshExecution)
    assert.deepEqual(secondExecution, { status: 'already-deleted', counts: null })
    console.log('Administrator account-deletion PostgreSQL integration checks passed.')
  } finally {
    try {
      if (isolatedDatabaseVerified) {
        await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "User"`)
        await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${triggerFunction}"()`)
        await db.user.deleteMany({ where: { id: { in: [targetId, otherId, rollbackId] } } })
        await db.verificationToken.deleteMany({
          where: { identifier: { in: [targetEmail, targetEmail.toUpperCase(), otherEmail, rollbackEmail] } },
        })
        await db.authRateLimit.deleteMany({ where: { keyHash: { in: [...rateHashes, ipRateHash, otherRateHash] } } })
      }
    } finally {
      if (connected) await db.$disconnect()
    }
  }
}

main().catch((error: unknown) => {
  if (error instanceof AccountDeletionError) {
    console.error(`Integration test failed: ${error.code}`)
  } else if (error instanceof Error && error.message.startsWith('ACCOUNT_DELETION_TEST_DATABASE_URL')) {
    console.error(error.message)
  } else if (error instanceof Error && error.message.startsWith('Integration tests require')) {
    console.error(error.message)
  } else if (error instanceof Error && (error.message.startsWith('Could not confirm')
    || error.message.startsWith('Integration tests are disabled'))) {
    console.error(error.message)
  } else {
    console.error('Integration test failed. Database details were not logged.')
  }
  process.exitCode = 1
})
