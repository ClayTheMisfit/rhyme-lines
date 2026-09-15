import 'dotenv/config'
import assert from 'node:assert/strict'
import { getDatabase } from '../src/lib/db'
import {
  CloudDocumentConflictError,
  CloudDocumentNotFoundError,
  checkpointCloudDocument,
  createCloudDocument,
  getCloudDocumentVersion,
  getCloudDocument,
  listCloudDocumentVersions,
  listCloudDocuments,
  restoreCloudDocumentVersion,
  transitionCloudDocument,
  updateCloudDocument,
} from '../src/lib/cloud-sync/service'
import type { CloudDocumentInput } from '../src/lib/cloud-sync/contracts'

const runId = `sync-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
const userA = `${runId}-a`
const userB = `${runId}-b`
const input = (clientDocumentId = 'local-a'): CloudDocumentInput => ({
  clientDocumentId,
  title: 'Sentinel draft',
  lines: [{ id: `${clientDocumentId}-line-0`, text: 'SYNC_TEST_SENTINEL' }],
  clientCreatedAt: 1_700_000_000_000,
  clientUpdatedAt: 1_700_000_000_100,
  lifecycle: 'ACTIVE',
  lifecycleChangedAt: null,
  isPinned: false,
  position: 1_700_000_000_100,
})

async function expectError(action: () => Promise<unknown>, constructor: new (...args: never[]) => Error) {
  try {
    await action()
    assert.fail(`Expected ${constructor.name}`)
  } catch (error) {
    assert.ok(error instanceof constructor, `Expected ${constructor.name}, received ${String(error)}`)
  }
}

async function main() {
  const db = getDatabase()
  try {
    await db.user.createMany({ data: [
      { id: userA, email: `${userA}@example.test` },
      { id: userB, email: `${userB}@example.test` },
    ] })

    const first = await createCloudDocument(userA, input())
    const retried = await createCloudDocument(userA, input())
    assert.equal(retried.id, first.id)
    assert.equal(retried.revision, 1)
    const initialHistory = await listCloudDocumentVersions(userA, first.id, { cursor: null, limit: 20 })
    assert.equal(initialHistory.versions.length, 1)
    assert.equal(initialHistory.versions[0].reason, 'INITIAL')
    assert.equal(initialHistory.versions[0].sourceRevision, 1)
    await checkpointCloudDocument(userA, first.id, 1)
    assert.equal((await listCloudDocumentVersions(userA, first.id, { cursor: null, limit: 20 })).versions.length, 1)
    assert.equal((await listCloudDocuments(userB)).documents.length, 0)

    const conflictDocument = await createCloudDocument(userA, input('conflict-doc'))
    const accepted = await updateCloudDocument(userA, conflictDocument.id, {
      ...input('conflict-doc'), title: 'Device A', baseRevision: 1,
    })
    assert.equal(accepted.revision, 2)
    await expectError(
      () => updateCloudDocument(userA, conflictDocument.id, {
        ...input('conflict-doc'), title: 'Device B', baseRevision: 1,
      }),
      CloudDocumentConflictError
    )
    assert.equal((await getCloudDocument(userA, conflictDocument.id)).title, 'Device A')

    const owned = await createCloudDocument(userA, input('owned-doc'))
    await expectError(() => getCloudDocument(userB, owned.id), CloudDocumentNotFoundError)
    await expectError(
      () => updateCloudDocument(userB, owned.id, { ...input('owned-doc'), baseRevision: 1 }),
      CloudDocumentNotFoundError
    )
    await expectError(() => transitionCloudDocument(userB, owned.id, 'trash', 1), CloudDocumentNotFoundError)
    await expectError(() => transitionCloudDocument(userB, owned.id, 'delete-permanently', 1), CloudDocumentNotFoundError)
    const ownedVersion = (await listCloudDocumentVersions(userA, owned.id, { cursor: null, limit: 20 })).versions[0]
    await expectError(() => listCloudDocumentVersions(userB, owned.id, { cursor: null, limit: 20 }), CloudDocumentNotFoundError)
    await expectError(() => getCloudDocumentVersion(userB, owned.id, ownedVersion.id), CloudDocumentNotFoundError)
    await expectError(() => checkpointCloudDocument(userB, owned.id, 1), CloudDocumentNotFoundError)
    await expectError(() => restoreCloudDocumentVersion(userB, owned.id, ownedVersion.id, 1), CloudDocumentNotFoundError)

    const lifecycle = await createCloudDocument(userA, input('lifecycle-doc'))
    assert.equal((await transitionCloudDocument(userA, lifecycle.id, 'archive', 1)).revision, 2)
    assert.equal((await transitionCloudDocument(userA, lifecycle.id, 'restore-archive', 2)).revision, 3)
    assert.equal((await transitionCloudDocument(userA, lifecycle.id, 'trash', 3)).revision, 4)
    assert.equal((await transitionCloudDocument(userA, lifecycle.id, 'restore-trash', 4)).revision, 5)
    assert.equal((await transitionCloudDocument(userA, lifecycle.id, 'trash', 5)).revision, 6)
    const lifecycleHistory = await listCloudDocumentVersions(userA, lifecycle.id, { cursor: null, limit: 20 })
    assert.equal(lifecycleHistory.versions.length, 6)
    assert.ok(lifecycleHistory.versions.some((version) => version.lifecycle === 'ARCHIVED'))
    assert.ok(lifecycleHistory.versions.some((version) => version.lifecycle === 'TRASHED'))
    const tombstone = await transitionCloudDocument(userA, lifecycle.id, 'delete-permanently', 6)
    assert.deepEqual(
      { lifecycle: tombstone.lifecycle, revision: tombstone.revision, title: tombstone.title, lines: tombstone.lines },
      { lifecycle: 'DELETED', revision: 7, title: null, lines: null }
    )
    const listing = await listCloudDocuments(userA)
    assert.equal(listing.documents.some((item) => item.id === lifecycle.id), false)
    assert.equal(listing.tombstones.some((item) => item.id === lifecycle.id), true)
    await expectError(() => listCloudDocumentVersions(userA, lifecycle.id, { cursor: null, limit: 20 }), CloudDocumentNotFoundError)
    assert.equal(await db.cloudDocumentVersion.count({ where: { documentId: lifecycle.id } }), 0)
    await createCloudDocument(userA, input('lifecycle-doc'))
    assert.equal(await db.cloudDocumentVersion.count({ where: { documentId: lifecycle.id } }), 0)
    await expectError(
      () => updateCloudDocument(userA, lifecycle.id, { ...input('lifecycle-doc'), baseRevision: 7 }),
      CloudDocumentConflictError
    )

    const baselineRecord = await db.cloudDocument.create({
      data: {
        userId: userA,
        clientDocumentId: 'existing-before-history',
        ...{
          title: 'Existing sentinel',
          content: { lines: [{ id: 'existing-line', text: 'EXISTING_HISTORY_SENTINEL' }] },
          clientCreatedAt: new Date(1_700_000_000_000),
          clientUpdatedAt: new Date(1_700_000_000_100),
          lifecycle: 'ACTIVE',
          lifecycleChangedAt: null,
          isPinned: false,
          position: 12,
        },
      },
    })
    assert.equal(await db.cloudDocumentVersion.count({ where: { documentId: baselineRecord.id } }), 0)
    const baseline = await checkpointCloudDocument(userA, baselineRecord.id, 1)
    assert.equal(baseline.reason, 'INITIAL')
    assert.equal((await getCloudDocumentVersion(userA, baselineRecord.id, baseline.id)).lines[0].text, 'EXISTING_HISTORY_SENTINEL')

    let paged = await createCloudDocument(userA, input('pagination-doc'))
    for (let revision = 2; revision <= 27; revision += 1) {
      paged = await updateCloudDocument(userA, paged.id, {
        ...input('pagination-doc'),
        title: `Page revision ${revision}`,
        clientUpdatedAt: 1_700_000_000_100 + revision,
        baseRevision: revision - 1,
      })
      await checkpointCloudDocument(userA, paged.id, revision)
    }
    const pageOne = await listCloudDocumentVersions(userA, paged.id, { cursor: null, limit: 10 })
    const pageTwo = await listCloudDocumentVersions(userA, paged.id, { cursor: pageOne.nextCursor, limit: 10 })
    const pageThree = await listCloudDocumentVersions(userA, paged.id, { cursor: pageTwo.nextCursor, limit: 10 })
    const allPageIds = [...pageOne.versions, ...pageTwo.versions, ...pageThree.versions].map((version) => version.id)
    assert.equal(pageOne.versions.length, 10)
    assert.equal(pageTwo.versions.length, 10)
    assert.equal(pageThree.versions.length, 7)
    assert.equal(new Set(allPageIds).size, 27)
    assert.deepEqual(
      [...pageOne.versions, ...pageTwo.versions, ...pageThree.versions].map((version) => version.sourceRevision),
      Array.from({ length: 27 }, (_, index) => 27 - index)
    )

    let restoreDocument = await createCloudDocument(userA, input('restore-doc'))
    let historicalVersionId = ''
    for (let revision = 2; revision <= 8; revision += 1) {
      restoreDocument = await updateCloudDocument(userA, restoreDocument.id, {
        ...input('restore-doc'),
        title: `Restore revision ${revision}`,
        lines: [{ id: 'restore-line', text: `RESTORE_SENTINEL_${revision}` }],
        clientUpdatedAt: 1_700_000_000_100 + revision,
        baseRevision: revision - 1,
      })
      if (revision < 8) {
        const checkpoint = await checkpointCloudDocument(userA, restoreDocument.id, revision)
        if (revision === 3) historicalVersionId = checkpoint.id
      }
    }
    const historicalBefore = await getCloudDocumentVersion(userA, restoreDocument.id, historicalVersionId)
    const restored = await restoreCloudDocumentVersion(userA, restoreDocument.id, historicalVersionId, 8)
    assert.equal(restored.document.revision, 9)
    assert.equal(restored.document.lines?.[0].text, 'RESTORE_SENTINEL_3')
    assert.equal(restored.version.reason, 'RESTORE')
    assert.equal((await getCloudDocumentVersion(userA, restoreDocument.id, historicalVersionId)).lines[0].text, historicalBefore.lines[0].text)
    const restoredHistory = await listCloudDocumentVersions(userA, restoreDocument.id, { cursor: null, limit: 20 })
    assert.ok(restoredHistory.versions.some((version) => version.sourceRevision === 8 && version.reason === 'PRE_RESTORE'))
    assert.ok(restoredHistory.versions.some((version) => version.sourceRevision === 9 && version.reason === 'RESTORE'))
    const historyCountBeforeConflict = await db.cloudDocumentVersion.count({ where: { documentId: restoreDocument.id } })
    await expectError(
      () => restoreCloudDocumentVersion(userA, restoreDocument.id, historicalVersionId, 8),
      CloudDocumentConflictError
    )
    assert.equal((await getCloudDocument(userA, restoreDocument.id)).revision, 9)
    assert.equal(await db.cloudDocumentVersion.count({ where: { documentId: restoreDocument.id } }), historyCountBeforeConflict)

    console.log('Cloud sync and version history database integration: 10 scenarios passed')
  } finally {
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } })
    await db.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.name : 'CloudSyncDatabaseTestError')
  process.exitCode = 1
})
