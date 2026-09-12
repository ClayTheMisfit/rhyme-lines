import {
  archiveProject,
  createProject,
  deleteProject,
  listProjectSummaries,
  restoreProject,
} from '@/lib/projects/storage'
import { loadPersistedAppState } from '@/lib/persist/appState'
import {
  getDraftPersistenceRevision,
  resetDraftPersistenceForTests,
  scheduleDraftPersistence,
} from '@/lib/persist/draftCoordinator'
import { CURRENT_SCHEMA_VERSION, STORAGE_KEYS, type DraftCollection } from '@/lib/persist/schema'
import { hydrateTabsFromPersisted, useTabsStore } from '@/store/tabsStore'

const initialCollection = (): DraftCollection => ({
  drafts: [
    {
      docId: 'project-a',
      title: 'Existing Draft',
      createdAt: 1,
      updatedAt: 2,
      lines: [{ id: 'project-a-line-0', text: 'original text' }],
    },
  ],
  activeId: 'project-a',
  folders: [],
})

const readStoredCollection = (): DraftCollection => {
  const raw = localStorage.getItem(STORAGE_KEYS.drafts)
  if (!raw) throw new Error('Expected persisted drafts')
  return (JSON.parse(raw) as { data: DraftCollection }).data
}

describe('draft collection writer ordering', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()
    const collection = initialCollection()
    localStorage.setItem(
      STORAGE_KEYS.drafts,
      JSON.stringify({ version: CURRENT_SCHEMA_VERSION, data: collection })
    )
    hydrateTabsFromPersisted(collection, { allowPersistence: true })
    jest.clearAllTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    resetDraftPersistenceForTests()
    jest.restoreAllMocks()
    jest.useRealTimers()
    localStorage.clear()
  })

  it('keeps a project created after an editor persistence timer was scheduled', () => {
    useTabsStore.getState().actions.updateSnapshot('project-a', { text: 'latest editor text' })

    const created = createProject('DO NOT DELETE THIS PROJECT')
    expect(readStoredCollection().drafts.some((draft) => draft.docId === created.id)).toBe(true)

    jest.advanceTimersByTime(300)

    const persisted = readStoredCollection()
    expect(persisted.drafts.find((draft) => draft.docId === 'project-a')?.lines[0]?.text).toBe(
      'latest editor text'
    )
    expect(persisted.drafts.find((draft) => draft.docId === created.id)?.title).toBe(
      'DO NOT DELETE THIS PROJECT'
    )
  })

  it('does not resurrect a project deleted after an editor timer was scheduled', () => {
    const removable = createProject('Delete this project')
    useTabsStore.getState().actions.updateSnapshot('project-a', { text: 'edit before delete' })

    deleteProject(removable.id)
    jest.advanceTimersByTime(300)

    const persisted = readStoredCollection()
    expect(persisted.drafts.some((draft) => draft.docId === removable.id)).toBe(false)
    expect(persisted.drafts.find((draft) => draft.docId === 'project-a')?.lines[0]?.text).toBe(
      'edit before delete'
    )
  })

  it('does not undo an archive performed after an editor timer was scheduled', () => {
    const archived = createProject('Archive this project')
    useTabsStore.getState().actions.updateSnapshot('project-a', { text: 'edit before archive' })

    archiveProject(archived.id)
    jest.advanceTimersByTime(300)

    const persistedDraft = readStoredCollection().drafts.find((draft) => draft.docId === archived.id)
    expect(persistedDraft?.archived).toBe(true)
    expect(typeof persistedDraft?.archivedAt).toBe('string')

    useTabsStore.getState().actions.updateSnapshot('project-a', { text: 'edit before restore' })
    restoreProject(archived.id)
    jest.advanceTimersByTime(300)

    const restoredDraft = readStoredCollection().drafts.find((draft) => draft.docId === archived.id)
    expect(restoredDraft?.archived).toBe(false)
    expect(restoredDraft?.archivedAt).toBeNull()
  })

  it('persists the latest content after rapid edits', () => {
    useTabsStore.getState().actions.updateSnapshot('project-a', { text: 'edit 1' })
    useTabsStore.getState().actions.updateSnapshot('project-a', { text: 'edit 2' })
    useTabsStore.getState().actions.updateSnapshot('project-a', { text: 'edit 3' })

    jest.advanceTimersByTime(300)

    expect(readStoredCollection().drafts[0]?.lines[0]?.text).toBe('edit 3')
  })

  it('does not let an older timer affect a successfully committed newer collection', () => {
    useTabsStore.getState().actions.updateSnapshot('project-a', { text: 'queued old revision' })
    const created = createProject('NEWER COMMITTED PROJECT')
    const afterNewerCommit = getDraftPersistenceRevision()

    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Late write rejected', 'QuotaExceededError')
    })
    jest.advanceTimersByTime(300)

    const persisted = readStoredCollection()
    expect(persisted.drafts.some((draft) => draft.docId === created.id)).toBe(true)
    expect(getDraftPersistenceRevision().acknowledged).toBe(afterNewerCommit.acknowledged)
  })

  it('does not advance acknowledgement when a storage write fails', () => {
    useTabsStore.getState().actions.updateSnapshot('project-a', { text: 'retry this edit' })
    const beforeFailure = getDraftPersistenceRevision()
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    jest.advanceTimersByTime(300)

    const afterFailure = getDraftPersistenceRevision()
    expect(afterFailure.current).toBe(beforeFailure.current)
    expect(afterFailure.acknowledged).toBeLessThan(afterFailure.current)
  })

  it('keeps the Cleanup 03 write gate active for invalid hydration', () => {
    resetDraftPersistenceForTests()
    localStorage.setItem(STORAGE_KEYS.drafts, '7')
    const loaded = loadPersistedAppState()
    hydrateTabsFromPersisted(loaded.drafts, {
      allowPersistence: loaded.hydration.drafts === 'ok' || loaded.hydration.drafts === 'missing',
    })
    useTabsStore.getState().actions.updateSnapshot(loaded.drafts.activeId, { text: 'must not replace' })
    scheduleDraftPersistence(10)

    jest.advanceTimersByTime(300)

    expect(loaded.hydration.drafts).toBe('invalid')
    expect(localStorage.getItem(STORAGE_KEYS.drafts)).toBe('7')
  })

  it('reloads a normal editor save from persisted storage', () => {
    useTabsStore.getState().actions.updateSnapshot('project-a', { text: 'survives editor reload' })
    jest.advanceTimersByTime(300)
    resetDraftPersistenceForTests()

    const reloaded = loadPersistedAppState()

    expect(reloaded.drafts.drafts[0]?.lines[0]?.text).toBe('survives editor reload')
  })

  it('reloads a normally created project from persisted storage', () => {
    const created = createProject('Created and reloaded')
    resetDraftPersistenceForTests()

    expect(listProjectSummaries().find((project) => project.id === created.id)?.title).toBe(
      'Created and reloaded'
    )
  })
})
