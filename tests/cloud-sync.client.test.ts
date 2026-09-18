import { waitFor } from '@testing-library/react'
import {
  cloudSyncManager,
  getCloudSyncRetryDelay,
  localDocumentVersion,
  resetCloudSyncForTests,
} from '@/lib/cloud-sync/client'
import { CLOUD_SYNC_STORAGE_KEY, emptyDocumentMetadata, readCloudSyncMetadata } from '@/lib/cloud-sync/metadata'
import {
  getAuthoritativeDraftCollection,
  initializeDraftPersistence,
  replaceAuthoritativeDraftCollection,
  resetDraftPersistenceForTests,
} from '@/lib/persist/draftCoordinator'
import type { DraftSchema } from '@/lib/persist/schema'
import { useCloudSyncStore } from '@/store/cloudSyncStore'
import type { CloudDocumentDto } from '@/lib/cloud-sync/contracts'
import { permanentlyDeleteProject } from '@/lib/projects/storage'
import { createDefaultDraftCollection } from '@/lib/persist/schema'

const draft = (text = 'local sentinel'): DraftSchema => ({
  docId: 'local-1',
  title: 'Sentinel',
  createdAt: 100,
  updatedAt: 200,
  archived: false,
  archivedAt: null,
  deletedAt: null,
  folderId: null,
  isPinned: false,
  position: 200,
  lines: [{ id: 'line-1', text }],
})

const dto = (source = draft(), revision = 1): CloudDocumentDto => ({
  id: 'cloud-1',
  clientDocumentId: source.docId,
  title: source.title ?? 'Untitled',
  lines: source.lines,
  clientCreatedAt: source.createdAt,
  clientUpdatedAt: source.updatedAt,
  lifecycle: source.deletedAt ? 'TRASHED' : source.archived ? 'ARCHIVED' : 'ACTIVE',
  lifecycleChangedAt: source.deletedAt ?? source.archivedAt ?? null,
  isPinned: source.isPinned === true,
  position: source.position ?? source.updatedAt,
  revision,
  deletedAt: source.deletedAt ?? null,
  serverUpdatedAt: '2026-09-14T00:00:00.000Z',
})

const response = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
}) as Response

const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()

const initializeLocal = (source = draft()) => {
  initializeDraftPersistence(
    { drafts: [source], activeId: source.docId, folders: [] },
    { allowPersistence: true, alreadyPersisted: true }
  )
}

describe('cloud sync queue', () => {
  it('uses bounded exponential retry delays', () => {
    expect([1, 2, 3, 4, 5, 20].map(getCloudSyncRetryDelay)).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000])
  })

  beforeEach(() => {
    resetCloudSyncForTests()
    resetDraftPersistenceForTests()
    localStorage.clear()
    fetchMock.mockReset()
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock })
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
  })

  afterEach(() => resetCloudSyncForTests())
  afterAll(() => { delete (globalThis as { fetch?: typeof fetch }).fetch })

  it('uploads a local document only after the persisted collection is available', async () => {
    initializeLocal()
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url) === '/api/account') return response(200, { user: { id: 'user-a', name: null, email: null } })
      if (String(url) === '/api/cloud/documents' && !init?.method) return response(200, { documents: [], tombstones: [] })
      return response(201, { document: dto() })
    })

    cloudSyncManager.start('ok')

    await waitFor(() => expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('synced'))
    const upload = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST')
    expect(upload).toBeDefined()
    const payload = JSON.parse(upload?.[1]?.body as string) as Record<string, unknown>
    expect(payload).not.toHaveProperty('userId')
    expect(payload.clientDocumentId).toBe('local-1')
  })

  it('keeps acknowledged edits offline and uploads after connectivity returns', async () => {
    initializeLocal()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url) === '/api/account') return response(200, { user: { id: 'user-a', name: null, email: null } })
      if (String(url) === '/api/cloud/documents' && !init?.method) return response(200, { documents: [], tombstones: [] })
      return response(201, { document: dto() })
    })

    cloudSyncManager.start('ok')
    await waitFor(() => expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('offline'))
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false)
    expect(getAuthoritativeDraftCollection().drafts[0].lines[0].text).toBe('local sentinel')

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
    window.dispatchEvent(new Event('online'))
    await waitFor(() => expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('synced'))
  })

  it('preserves newer local content and surfaces a stale revision conflict', async () => {
    const initial = draft()
    initializeLocal(initial)
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url) === '/api/account') return response(200, { user: { id: 'user-a', name: null, email: null } })
      if (String(url) === '/api/cloud/documents' && !init?.method) return response(200, { documents: [], tombstones: [] })
      if (init?.method === 'POST') return response(201, { document: dto(initial, 1) })
      return response(409, { error: 'conflict', documentId: 'cloud-1', expectedRevision: 1, currentRevision: 2 })
    })
    cloudSyncManager.start('ok')
    await waitFor(() => expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('synced'))

    const changed = { ...initial, updatedAt: 300, lines: [{ id: 'line-1', text: 'Device B unsynced work' }] }
    replaceAuthoritativeDraftCollection({ drafts: [changed], activeId: changed.docId, folders: [] }, { persist: 'immediate' })

    await waitFor(() => expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('conflict'))
    expect(getAuthoritativeDraftCollection().drafts[0].lines[0].text).toBe('Device B unsynced work')
  })

  it('pauses instead of crossing associations when the signed-in account changes', async () => {
    const source = draft()
    initializeLocal(source)
    localStorage.setItem(CLOUD_SYNC_STORAGE_KEY, JSON.stringify({
      version: 1,
      lastAccountId: 'user-a',
      accounts: {
        'user-a': {
          initialized: true,
          associations: {
            'local-1': {
              ...emptyDocumentMetadata(),
              cloudDocumentId: 'cloud-a',
              lastKnownServerRevision: 4,
              lastKnownLifecycle: 'ACTIVE',
              lastSyncedLocalVersion: localDocumentVersion(source),
              state: 'synced',
            },
          },
        },
      },
    }))
    fetchMock.mockResolvedValue(response(200, { user: { id: 'user-b', name: null, email: null } }))

    cloudSyncManager.start('ok')
    await waitFor(() => expect(useCloudSyncStore.getState().accountState).toBe('account-switch'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getAuthoritativeDraftCollection().drafts[0].lines[0].text).toBe('local sentinel')
  })

  it('bootstraps a genuinely uninitialized browser through the coordinator', async () => {
    initializeDraftPersistence(createDefaultDraftCollection(), { allowPersistence: true, alreadyPersisted: false })
    const cloudDraft = { ...draft('from cloud'), docId: 'cloud-client-id', title: 'Cloud draft' }
    fetchMock.mockImplementation(async (url) => {
      if (String(url) === '/api/account') return response(200, { user: { id: 'user-a', name: null, email: null } })
      return response(200, { documents: [dto(cloudDraft, 3)], tombstones: [] })
    })

    cloudSyncManager.start('missing')
    await waitFor(() => expect(getAuthoritativeDraftCollection().drafts[0]?.docId).toBe('cloud-client-id'))
    expect(getAuthoritativeDraftCollection().drafts[0]?.lines[0].text).toBe('from cloud')
    expect(useCloudSyncStore.getState().documentStates['cloud-client-id']).toBe('synced')
  })

  it('does not treat an intentionally empty initialized collection as a fresh device', async () => {
    initializeDraftPersistence({ drafts: [], activeId: null, folders: [] }, { allowPersistence: true, alreadyPersisted: true })
    localStorage.setItem(CLOUD_SYNC_STORAGE_KEY, JSON.stringify({
      version: 1,
      lastAccountId: 'user-a',
      accounts: { 'user-a': { initialized: true, associations: {} } },
    }))
    fetchMock.mockImplementation(async (url) => {
      if (String(url) === '/api/account') return response(200, { user: { id: 'user-a', name: null, email: null } })
      return response(200, { documents: [dto()], tombstones: [] })
    })

    cloudSyncManager.start('ok')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/cloud/documents', { cache: 'no-store' }))
    expect(getAuthoritativeDraftCollection().drafts).toEqual([])
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false)
  })

  it('uses explicit lifecycle and tombstone endpoints after local acknowledgement', async () => {
    const initial = draft()
    initializeLocal(initial)
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url) === '/api/account') return response(200, { user: { id: 'user-a', name: null, email: null } })
      if (String(url) === '/api/cloud/documents' && !init?.method) return response(200, { documents: [], tombstones: [] })
      if (init?.method === 'POST') return response(201, { document: dto(initial, 1) })
      if (init?.method === 'PATCH') {
        const body = JSON.parse(init.body as string) as { action: string }
        const current = getAuthoritativeDraftCollection().drafts[0]
        return response(200, { document: dto(current, body.action === 'archive' ? 2 : 3) })
      }
      return response(200, {
        document: { ...dto(initial, 4), lifecycle: 'DELETED', title: null, lines: null, deletedAt: '2026-09-14T00:01:00.000Z' },
      })
    })
    cloudSyncManager.start('ok')
    await waitFor(() => expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('synced'))

    const archived = { ...initial, archived: true, archivedAt: '2026-09-14T00:00:00.000Z' }
    replaceAuthoritativeDraftCollection({ drafts: [archived], activeId: null, folders: [] }, { persist: 'immediate' })
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'PATCH')).toBe(true))
    await waitFor(() => expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('synced'))

    const trashed = { ...archived, deletedAt: '2026-09-14T00:00:30.000Z' }
    replaceAuthoritativeDraftCollection({ drafts: [trashed], activeId: null, folders: [] }, { persist: 'immediate' })
    await waitFor(() => expect(fetchMock.mock.calls.filter((call) => call[1]?.method === 'PATCH')).toHaveLength(2))
    await waitFor(() => expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('synced'))

    permanentlyDeleteProject('local-1')
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'DELETE')).toBe(true))
    await waitFor(() => expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('deleted'))
    expect(getAuthoritativeDraftCollection().drafts).toEqual([])
  })

  it('pauses on authentication expiry without clearing local work', async () => {
    initializeLocal()
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url) === '/api/account') return response(200, { user: { id: 'user-a', name: null, email: null } })
      if (String(url) === '/api/cloud/documents' && !init?.method) return response(200, { documents: [], tombstones: [] })
      return response(401, { error: 'Authentication required' })
    })

    cloudSyncManager.start('ok')
    await waitFor(() => expect(useCloudSyncStore.getState().accountState).toBe('auth-required'))
    expect(getAuthoritativeDraftCollection().drafts[0].lines[0].text).toBe('local sentinel')
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(1)
  })

  it('turns an in-flight initial upload into a tombstone when local deletion wins the race', async () => {
    const trashed = { ...draft(), deletedAt: '2026-09-14T00:00:00.000Z' }
    initializeLocal(trashed)
    let finishUpload: ((value: Response) => void) | undefined
    const uploadResponse = new Promise<Response>((resolve) => { finishUpload = resolve })
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url) === '/api/account') return response(200, { user: { id: 'user-a', name: null, email: null } })
      if (String(url) === '/api/cloud/documents' && !init?.method) return response(200, { documents: [], tombstones: [] })
      if (init?.method === 'POST') return uploadResponse
      return response(200, {
        document: { ...dto(trashed, 2), lifecycle: 'DELETED', title: null, lines: null },
      })
    })
    cloudSyncManager.start('ok')
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(true))

    permanentlyDeleteProject('local-1')
    finishUpload?.(response(201, { document: dto(trashed, 1) }))

    await waitFor(() => expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'DELETE')).toBe(true))
    await waitFor(() => expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('deleted'))
    expect(getAuthoritativeDraftCollection().drafts).toEqual([])
  })

  it('coalesces rapid acknowledged edits into one follow-up update', async () => {
    const initial = draft()
    initializeLocal(initial)
    let finishFirstUpdate: ((value: Response) => void) | undefined
    const firstUpdateResponse = new Promise<Response>((resolve) => { finishFirstUpdate = resolve })
    let putCount = 0
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url) === '/api/account') return response(200, { user: { id: 'user-a', name: null, email: null } })
      if (String(url) === '/api/cloud/documents' && !init?.method) return response(200, { documents: [], tombstones: [] })
      if (init?.method === 'POST') return response(201, { document: dto(initial, 1) })
      putCount += 1
      if (putCount === 1) return firstUpdateResponse
      const latest = getAuthoritativeDraftCollection().drafts[0]
      return response(200, { document: dto(latest, 3) })
    })
    cloudSyncManager.start('ok')
    await waitFor(() => expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('synced'))

    const first = { ...initial, updatedAt: 300, lines: [{ id: 'line-1', text: 'first edit' }] }
    replaceAuthoritativeDraftCollection({ drafts: [first], activeId: first.docId, folders: [] }, { persist: 'immediate' })
    await waitFor(() => expect(putCount).toBe(1))
    const second = { ...first, updatedAt: 400, lines: [{ id: 'line-1', text: 'second edit' }] }
    const latest = { ...second, updatedAt: 500, lines: [{ id: 'line-1', text: 'latest edit' }] }
    replaceAuthoritativeDraftCollection({ drafts: [second], activeId: second.docId, folders: [] }, { persist: 'immediate' })
    replaceAuthoritativeDraftCollection({ drafts: [latest], activeId: latest.docId, folders: [] }, { persist: 'immediate' })
    expect(putCount).toBe(1)

    finishFirstUpdate?.(response(200, { document: dto(first, 2) }))
    await waitFor(() => expect(putCount).toBe(2))
    await waitFor(() => expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('synced'))
    const putBodies = fetchMock.mock.calls
      .filter((call) => call[1]?.method === 'PUT')
      .map((call) => JSON.parse(call[1]?.body as string) as { lines: Array<{ text: string }> })
    expect(putBodies).toHaveLength(2)
    expect(putBodies[1].lines[0].text).toBe('latest edit')
  })

  it('applies a successful restore through the coordinator without a revision N+2 upload', async () => {
    const initial = { ...draft('current revision eight'), updatedAt: 800 }
    initializeLocal(initial)
    localStorage.setItem(CLOUD_SYNC_STORAGE_KEY, JSON.stringify({
      version: 1,
      lastAccountId: 'user-a',
      accounts: {
        'user-a': {
          initialized: true,
          associations: {
            'local-1': {
              ...emptyDocumentMetadata(),
              cloudDocumentId: 'cloud-1',
              lastKnownServerRevision: 8,
              lastKnownLifecycle: 'ACTIVE',
              lastSyncedLocalVersion: localDocumentVersion(initial),
              state: 'synced',
            },
          },
        },
      },
    }))
    const restoredDraft = { ...initial, title: 'Historical', updatedAt: 300, lines: [{ id: 'line-1', text: 'historical revision three' }] }
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url) === '/api/account') return response(200, { user: { id: 'user-a', name: null, email: null } })
      if (String(url) === '/api/cloud/documents' && !init?.method) return response(200, { documents: [dto(initial, 8)], tombstones: [] })
      if (String(url).endsWith('/restore')) return response(200, { document: dto(restoredDraft, 9) })
      return response(201, { version: { id: 'version-9' } })
    })

    cloudSyncManager.start('ok')
    await waitFor(() => expect(useCloudSyncStore.getState().accountState).toBe('ready'))
    const result = await cloudSyncManager.restoreVersion('local-1', 'version-3')

    expect(result.ok).toBe(true)
    expect(getAuthoritativeDraftCollection().drafts[0].lines[0].text).toBe('historical revision three')
    expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('synced')
    expect(readCloudSyncMetadata().accounts['user-a'].associations['local-1'].lastKnownServerRevision).toBe(9)
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === 'PUT')).toHaveLength(0)
  })

  it('preserves local work that changes while a server restore is in flight', async () => {
    const initial = { ...draft('current revision eight'), updatedAt: 800 }
    initializeLocal(initial)
    localStorage.setItem(CLOUD_SYNC_STORAGE_KEY, JSON.stringify({
      version: 1,
      lastAccountId: 'user-a',
      accounts: {
        'user-a': {
          initialized: true,
          associations: {
            'local-1': {
              ...emptyDocumentMetadata(),
              cloudDocumentId: 'cloud-1',
              lastKnownServerRevision: 8,
              lastKnownLifecycle: 'ACTIVE',
              lastSyncedLocalVersion: localDocumentVersion(initial),
              state: 'synced',
            },
          },
        },
      },
    }))
    let finishRestore: ((value: Response) => void) | undefined
    const restoreResponse = new Promise<Response>((resolve) => { finishRestore = resolve })
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url) === '/api/account') return response(200, { user: { id: 'user-a', name: null, email: null } })
      if (String(url) === '/api/cloud/documents' && !init?.method) return response(200, { documents: [dto(initial, 8)], tombstones: [] })
      if (String(url).endsWith('/restore')) return restoreResponse
      return response(201, { version: { id: 'version-9' } })
    })

    cloudSyncManager.start('ok')
    await waitFor(() => expect(useCloudSyncStore.getState().accountState).toBe('ready'))
    const restore = cloudSyncManager.restoreVersion('local-1', 'version-3')
    const newerLocal = { ...initial, updatedAt: 900, lines: [{ id: 'line-1', text: 'unsynchronized local work' }] }
    replaceAuthoritativeDraftCollection({ drafts: [newerLocal], activeId: 'local-1', folders: [] }, { persist: 'immediate' })
    finishRestore?.(response(200, { document: dto({ ...initial, updatedAt: 300, lines: [{ id: 'line-1', text: 'historical' }] }, 9) }))

    const result = await restore
    expect(result).toMatchObject({ ok: false, kind: 'conflict' })
    expect(getAuthoritativeDraftCollection().drafts[0].lines[0].text).toBe('unsynchronized local work')
    expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('conflict')
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === 'PUT')).toHaveLength(0)
  })

  it('preserves local content when the restore base revision is stale', async () => {
    const initial = { ...draft('local revision eight'), updatedAt: 800 }
    initializeLocal(initial)
    localStorage.setItem(CLOUD_SYNC_STORAGE_KEY, JSON.stringify({
      version: 1,
      lastAccountId: 'user-a',
      accounts: {
        'user-a': {
          initialized: true,
          associations: {
            'local-1': {
              ...emptyDocumentMetadata(),
              cloudDocumentId: 'cloud-1',
              lastKnownServerRevision: 8,
              lastKnownLifecycle: 'ACTIVE',
              lastSyncedLocalVersion: localDocumentVersion(initial),
              state: 'synced',
            },
          },
        },
      },
    }))
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url) === '/api/account') return response(200, { user: { id: 'user-a', name: null, email: null } })
      if (String(url) === '/api/cloud/documents' && !init?.method) return response(200, { documents: [dto(initial, 8)], tombstones: [] })
      if (String(url).endsWith('/restore')) return response(409, { error: 'conflict', currentRevision: 9 })
      return response(201, { version: { id: 'version-8' } })
    })

    cloudSyncManager.start('ok')
    await waitFor(() => expect(useCloudSyncStore.getState().accountState).toBe('ready'))
    const result = await cloudSyncManager.restoreVersion('local-1', 'version-3')

    expect(result).toMatchObject({ ok: false, kind: 'conflict' })
    expect(getAuthoritativeDraftCollection().drafts[0].lines[0].text).toBe('local revision eight')
    expect(readCloudSyncMetadata().accounts['user-a'].associations['local-1'].lastKnownServerRevision).toBe(9)
    expect(useCloudSyncStore.getState().documentStates['local-1']).toBe('conflict')
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === 'PUT')).toHaveLength(0)
  })
})
