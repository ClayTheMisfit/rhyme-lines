import { waitFor } from '@testing-library/react'

import { cloudSyncManager, conflictLocalMarker, draftToCloudInput, resetCloudSyncForTests, type ConflictPreview } from '@/lib/cloud-sync/client'

import { CLOUD_SYNC_STORAGE_KEY, readCloudSyncMetadata } from '@/lib/cloud-sync/metadata'

import { getAuthoritativeDraftCollection, initializeDraftPersistence, replaceAuthoritativeDraftCollection, resetDraftPersistenceForTests } from '@/lib/persist/draftCoordinator'

import type { DraftSchema } from '@/lib/persist/schema'

import type { CloudDocumentDto } from '@/lib/cloud-sync/contracts'

import { useCloudSyncStore } from '@/store/cloudSyncStore'



const local: DraftSchema = { docId: 'conflict-1', title: 'Song', createdAt: 100, updatedAt: 200, lines: [{ id: 'line', text: 'LOCAL' }] }

const initialCloud: CloudDocumentDto = { id: 'cloud-1', clientDocumentId: local.docId, title: 'Cloud Song', lines: [{ id: 'cloud-line', text: 'CLOUD' }], clientCreatedAt: 100, clientUpdatedAt: 300, lifecycle: 'ACTIVE', lifecycleChangedAt: null, isPinned: false, position: 300, revision: 5, deletedAt: null, serverUpdatedAt: '2026-09-18T00:00:00Z' }

const response = (status: number, payload: unknown) => ({ status, ok: status < 300, json: async () => payload }) as Response

const fetchMock = jest.fn()

let cloud: CloudDocumentDto

let preview: ConflictPreview

let accountId: string | null

const drafts = () => getAuthoritativeDraftCollection().drafts

const association = () => readCloudSyncMetadata().accounts['user-a'].associations[local.docId]

const changeLocal = (text: string) => replaceAuthoritativeDraftCollection({ ...getAuthoritativeDraftCollection(), drafts: drafts().map((draft) => draft.docId === local.docId ? { ...draft, lines: [{ id: 'line', text }] } : draft) }, { persist: 'immediate' })



beforeEach(async () => {

  resetCloudSyncForTests(); resetDraftPersistenceForTests(); localStorage.clear()

  Object.defineProperty(globalThis, 'structuredClone', { configurable: true, value: (value: unknown) => JSON.parse(JSON.stringify(value)) })
  accountId = 'user-a'; cloud = structuredClone(initialCloud)

  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })

  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock })

  fetchMock.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {

    if (url === '/api/account') return response(200, { user: accountId ? { id: accountId } : null })

    if (url === '/api/cloud/documents' && !init?.method) return response(200, { documents: cloud.lifecycle === 'DELETED' ? [] : [cloud], tombstones: cloud.lifecycle === 'DELETED' ? [cloud] : [] })

    if (url === '/api/cloud/documents/cloud-1' && !init?.method) return response(200, { document: cloud })

    if (url === '/api/cloud/documents/cloud-1' && init?.method === 'PATCH') {
      cloud = { ...cloud, lifecycle: 'TRASHED', revision: cloud.revision + 1 }
      return response(200, { document: cloud })
    }

    if (url === '/api/cloud/documents/cloud-1' && init?.method === 'DELETE') {
      cloud = { ...cloud, lifecycle: 'DELETED', revision: cloud.revision + 1 }
      return response(200, { document: cloud })
    }

    if (url.endsWith('/resolve')) {

      const body = JSON.parse(init?.body as string)

      if (body.baseRevision !== cloud.revision || cloud.lifecycle === 'DELETED') return response(409, { currentRevision: cloud.revision })

      cloud = { ...cloud, ...body, clientCreatedAt: body.clientCreatedAt, clientUpdatedAt: body.clientUpdatedAt, revision: cloud.revision + 1 }

      return response(200, { document: cloud })

    }

    if (init?.method === 'POST' && url === '/api/cloud/documents') {

      const body = JSON.parse(init.body as string)

      return response(201, { document: { ...initialCloud, ...body, id: 'copy-cloud', revision: 1 } })

    }

    return response(200, {})

  })

  initializeDraftPersistence({ drafts: [structuredClone(local)], activeId: local.docId, folders: [] }, { allowPersistence: true })

  cloudSyncManager.start('ok')

  await waitFor(() => expect(useCloudSyncStore.getState().documentStates[local.docId]).toBe('conflict'))

  preview = await cloudSyncManager.inspectConflict(local.docId)

})

afterEach(() => { resetCloudSyncForTests(); jest.restoreAllMocks() })



it('persists metadata without lyric bodies and stops retry through reload', async () => {

  expect(association().conflict?.serverRevisionAtConflict).toBe(5)

  expect(localStorage.getItem(CLOUD_SYNC_STORAGE_KEY)).not.toContain('LOCAL')

  expect(localStorage.getItem(CLOUD_SYNC_STORAGE_KEY)).not.toContain('CLOUD')

  resetCloudSyncForTests(); cloudSyncManager.start('ok')

  await waitFor(() => expect(useCloudSyncStore.getState().documentStates[local.docId]).toBe('conflict'))

  expect(drafts()[0].lines[0].text).toBe('LOCAL')

  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)

})

it('lets permanent deletion supersede a conflict and reach the cloud', async () => {
  replaceAuthoritativeDraftCollection({ ...getAuthoritativeDraftCollection(), drafts: [], activeId: null }, { persist: 'immediate' })
  cloudSyncManager.markPermanentDeletion(local.docId)

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    '/api/cloud/documents/cloud-1',
    expect.objectContaining({ method: 'PATCH' })
  ))
  await waitFor(() => expect(association().pendingPermanentDelete).toBe(false))
  expect(association().state).toBe('deleted')
})

it('Keep Local submits explicit intent with fresh revision, clears only on acceptance', async () => {

  expect(await cloudSyncManager.resolveConflict(local.docId, 'keep-local', preview)).toEqual({ ok: true })

  expect(cloud.revision).toBe(6); expect(cloud.lines?.[0].text).toBe('LOCAL')

  expect(association().state).toBe('synced'); expect(association().conflict).toBeNull()

  const mutation = fetchMock.mock.calls.find(([url]) => url.endsWith('/resolve'))

  expect(JSON.parse(mutation[1].body)).toMatchObject({ intent: 'keep-local', baseRevision: 5, clientDocumentId: local.docId })

  expect(JSON.parse(mutation[1].body)).not.toHaveProperty('userId')

  expect((await cloudSyncManager.resolveConflict(local.docId, 'keep-local', preview)).ok).toBe(false)

  expect(cloud.revision).toBe(6)

})

it.each(['keep-local', 'use-cloud', 'save-both'] as const)('%s blocks an unseen server change', async (action) => {

  cloud = { ...cloud, revision: 6, lines: [{ id: 'new', text: 'NEW CLOUD' }] }

  const result = await cloudSyncManager.resolveConflict(local.docId, action, preview)

  expect(result).toMatchObject({ ok: false, kind: 'stale' }); expect(cloud.revision).toBe(6)

  expect(drafts()).toHaveLength(1); expect(drafts()[0].lines[0].text).toBe('LOCAL'); expect(association().state).toBe('conflict')

})

it.each(['keep-local', 'use-cloud', 'save-both'] as const)('%s blocks same-timestamp canonical local edits', async (action) => {

  changeLocal('NEW LOCAL')

  expect(await cloudSyncManager.resolveConflict(local.docId, action, preview)).toMatchObject({ ok: false, kind: 'stale' })

  expect(drafts()[0].lines[0].text).toBe('NEW LOCAL'); expect(cloud.revision).toBe(5)

})

it.each(['use-cloud', 'save-both'] as const)('%s persists an independent recovery copy before adopting cloud', async (action) => {

  expect(await cloudSyncManager.resolveConflict(local.docId, action, preview)).toEqual({ ok: true })

  expect(drafts().find((draft) => draft.docId === local.docId)?.lines[0].text).toBe('CLOUD')

  const copy = drafts().find((draft) => draft.docId !== local.docId)!

  expect(copy.title).toBe('Song — Conflict Copy'); expect(copy.lines[0].text).toBe('LOCAL'); expect(copy.docId).not.toBe(local.docId)

  expect(cloud.revision).toBe(5); expect(association().conflict).toBeNull()

  await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/cloud/documents' && init?.method === 'POST')).toBe(true))

})

it.each(['use-cloud', 'save-both'] as const)('%s does not replace when recovery persistence fails', async (action) => {

  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })

  expect(await cloudSyncManager.resolveConflict(local.docId, action, preview)).toMatchObject({ ok: false })

  expect(drafts()).toHaveLength(1); expect(drafts()[0].lines[0].text).toBe('LOCAL'); expect(cloud.revision).toBe(5)

})

it('partial replacement failure retains recovery and conflict; retry reuses copy', async () => {

  const original = Storage.prototype.setItem

  let draftWrites = 0

  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {

    if (key === 'rhyme-lines:persist:drafts' && ++draftWrites === 3) throw new Error('quota')

    return original.call(this, key, value)

  })

  const result = await cloudSyncManager.resolveConflict(local.docId, 'save-both', preview)

  expect(result.ok).toBe(false); expect(drafts()).toHaveLength(2); expect(drafts()[0].lines[0].text).toBe('LOCAL')

  expect(association().state).toBe('conflict')

  spy.mockRestore()

  expect(await cloudSyncManager.resolveConflict(local.docId, 'save-both', preview)).toEqual({ ok: true })

  expect(drafts()).toHaveLength(2)

})

it('Keep Local rejects a server race after revalidation and preserves conflict', async () => {

  const previous = fetchMock.getMockImplementation()!

  fetchMock.mockImplementation(async (url, init) => {

    if (url.endsWith('/resolve')) { cloud = { ...cloud, revision: 6 }; return response(409, { currentRevision: 6 }) }

    return previous(url, init)

  })

  expect(await cloudSyncManager.resolveConflict(local.docId, 'keep-local', preview)).toMatchObject({ ok: false, kind: 'stale' })

  expect(drafts()[0].lines[0].text).toBe('LOCAL'); expect(association().state).toBe('conflict')

})

it('newer local edit during Keep Local stays conflicting after accepted server update', async () => {

  const previous = fetchMock.getMockImplementation()!

  fetchMock.mockImplementation(async (url, init) => {

    if (url.endsWith('/resolve')) changeLocal('DURING REQUEST')

    return previous(url, init)

  })

  expect(await cloudSyncManager.resolveConflict(local.docId, 'keep-local', preview)).toMatchObject({ ok: false, kind: 'stale' })

  expect(cloud.lines?.[0].text).toBe('LOCAL'); expect(drafts()[0].lines[0].text).toBe('DURING REQUEST'); expect(association().state).toBe('conflict')

})

it('local edit during recovery revalidation cannot be replaced', async () => {

  const previous = fetchMock.getMockImplementation()!

  let gets = 0

  fetchMock.mockImplementation(async (url, init) => {

    if (url === '/api/cloud/documents/cloud-1' && ++gets === 2) changeLocal('DURING RECOVERY')

    return previous(url, init)

  })

  expect(await cloudSyncManager.resolveConflict(local.docId, 'use-cloud', preview)).toMatchObject({ ok: false, kind: 'stale' })

  expect(drafts()[0].lines[0].text).toBe('DURING RECOVERY'); expect(drafts()[1].lines[0].text).toBe('LOCAL')

})

it('blocks offline without network access', async () => {

  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })

  fetchMock.mockClear()

  expect(await cloudSyncManager.resolveConflict(local.docId, 'keep-local', preview)).toMatchObject({ ok: false, kind: 'blocked' })

  expect(fetchMock).not.toHaveBeenCalled(); expect(association().state).toBe('conflict')

})

it.each([null, 'user-b'])('rejects account expiry/switch to %s before resolution', async (nextAccount) => {

  accountId = nextAccount

  expect((await cloudSyncManager.resolveConflict(local.docId, 'use-cloud', preview)).ok).toBe(false)

  expect(drafts()).toHaveLength(1); expect(drafts()[0].lines[0].text).toBe('LOCAL')

  expect(cloudSyncManager.getConflictTarget(local.docId)).toBeNull()

  expect(useCloudSyncStore.getState().documentStates).toEqual({})

})

it('auth expiry on GET preserves conflict and stops actions', async () => {

  const previous = fetchMock.getMockImplementation()!

  fetchMock.mockImplementation(async (url, init) => url === '/api/cloud/documents/cloud-1' ? response(401, {}) : previous(url, init))

  expect((await cloudSyncManager.resolveConflict(local.docId, 'save-both', preview)).ok).toBe(false)

  expect(useCloudSyncStore.getState().accountState).toBe('auth-required'); expect(association().state).toBe('conflict')

})

it.each(['keep-local', 'use-cloud', 'save-both'] as const)('%s preserves tombstone and local candidate with new identity', async (action) => {

  cloud = { ...cloud, lifecycle: 'DELETED', title: null, lines: null }

  preview = await cloudSyncManager.inspectConflict(local.docId)

  expect(await cloudSyncManager.resolveConflict(local.docId, action, preview)).toEqual({ ok: true })

  expect(drafts()).toHaveLength(1); expect(drafts()[0].docId).not.toBe(local.docId); expect(drafts()[0].lines[0].text).toBe('LOCAL')

  expect(association().state).toBe('deleted'); expect(cloud.lifecycle).toBe('DELETED'); expect(cloud.revision).toBe(5)

})

it.each(['ARCHIVED', 'TRASHED'] as const)('Use Cloud adopts %s lifecycle with active recovery', async (lifecycle) => {

  cloud = { ...cloud, lifecycle, lifecycleChangedAt: '2026-09-18T00:00:00Z', deletedAt: lifecycle === 'TRASHED' ? '2026-09-18T00:00:00Z' : null }

  preview = await cloudSyncManager.inspectConflict(local.docId)

  expect(await cloudSyncManager.resolveConflict(local.docId, 'use-cloud', preview)).toEqual({ ok: true })

  expect(draftToCloudInput(drafts()[0]).lifecycle).toBe(lifecycle)

  expect(draftToCloudInput(drafts()[1]).lifecycle).toBe('ACTIVE')

})

it('temporary exact markers distinguish content without mixing versions', () => {

  expect(conflictLocalMarker(local)).not.toBe(conflictLocalMarker({ ...local, lines: [{ id: 'line', text: 'DIFFERENT' }] }))

  expect(drafts()[0].lines[0].text).toBe('LOCAL')

})
