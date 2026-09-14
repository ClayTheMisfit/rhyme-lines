import 'dotenv/config'
import assert from 'node:assert/strict'
import { getDatabase } from '../src/lib/db'
import {
  CloudDocumentConflictError,
  CloudDocumentNotFoundError,
  createCloudDocument,
  getCloudDocument,
  listCloudDocuments,
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

    const lifecycle = await createCloudDocument(userA, input('lifecycle-doc'))
    assert.equal((await transitionCloudDocument(userA, lifecycle.id, 'archive', 1)).revision, 2)
    assert.equal((await transitionCloudDocument(userA, lifecycle.id, 'restore-archive', 2)).revision, 3)
    assert.equal((await transitionCloudDocument(userA, lifecycle.id, 'trash', 3)).revision, 4)
    assert.equal((await transitionCloudDocument(userA, lifecycle.id, 'restore-trash', 4)).revision, 5)
    assert.equal((await transitionCloudDocument(userA, lifecycle.id, 'trash', 5)).revision, 6)
    const tombstone = await transitionCloudDocument(userA, lifecycle.id, 'delete-permanently', 6)
    assert.deepEqual(
      { lifecycle: tombstone.lifecycle, revision: tombstone.revision, title: tombstone.title, lines: tombstone.lines },
      { lifecycle: 'DELETED', revision: 7, title: null, lines: null }
    )
    const listing = await listCloudDocuments(userA)
    assert.equal(listing.documents.some((item) => item.id === lifecycle.id), false)
    assert.equal(listing.tombstones.some((item) => item.id === lifecycle.id), true)
    await expectError(
      () => updateCloudDocument(userA, lifecycle.id, { ...input('lifecycle-doc'), baseRevision: 7 }),
      CloudDocumentConflictError
    )

    console.log('Cloud sync database integration: 4 scenarios passed')
  } finally {
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } })
    await db.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.name : 'CloudSyncDatabaseTestError')
  process.exitCode = 1
})
