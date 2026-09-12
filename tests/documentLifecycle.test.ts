import { migrateDrafts } from '@/lib/persist/migrations'
import { createDefaultDraftCollection, type DraftCollection, type DraftSchema } from '@/lib/persist/schema'
import {
  getAuthoritativeDraftCollection,
  resetDraftPersistenceForTests,
} from '@/lib/persist/draftCoordinator'
import {
  archiveProject,
  moveProjectToTrash,
  permanentlyDeleteProject,
  restoreProject,
  restoreProjectFromTrash,
} from '@/lib/projects/storage'
import { hydrateTabsFromPersisted, useTabsStore } from '@/store/tabsStore'

const draft = (
  id: string,
  lifecycle: Partial<Pick<DraftSchema, 'archived' | 'archivedAt' | 'deletedAt'>> = {}
): DraftSchema => ({
  docId: id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  lines: [{ id: `${id}-line-0`, text: id }],
  ...lifecycle,
})

const hydrate = (collection: DraftCollection) => {
  resetDraftPersistenceForTests()
  hydrateTabsFromPersisted(collection, { allowPersistence: true })
  return useTabsStore.getState()
}

describe('canonical document lifecycle', () => {
  it('keeps missing first-run state distinct from a persisted empty collection', () => {
    const missing = migrateDrafts([])

    expect(missing.status).toBe('missing')
    expect(missing.data.drafts).toHaveLength(1)
    expect(missing.data.activeId).toBe(missing.data.drafts[0]?.docId)
    expect(createDefaultDraftCollection().drafts).toHaveLength(1)
  })

  it('preserves an explicitly persisted empty collection during migration and hydration', () => {
    const migrated = migrateDrafts([{
      key: 'drafts',
      value: JSON.stringify({ version: 2, data: { drafts: [], activeId: null, folders: [] } }),
    }])

    expect(migrated.data).toEqual({ drafts: [], activeId: null, folders: [] })
    const state = hydrate(migrated.data)
    expect(state.tabs).toEqual([])
    expect(state.activeTabId).toBeNull()
  })

  it('deleting the final editor document leaves no replacement tab', () => {
    hydrate({ drafts: [draft('final')], activeId: 'final', folders: [] })

    useTabsStore.getState().actions.deleteTab('final')

    const state = useTabsStore.getState()
    expect(state.tabs).toEqual([])
    expect(state.activeTabId).toBeNull()
  })

  it('projects only live drafts into ordinary editor tabs', () => {
    const state = hydrate({
      drafts: [
        draft('live'),
        draft('archived', { archived: true, archivedAt: '2026-01-01T00:00:00.000Z' }),
        draft('trashed', { deletedAt: '2026-01-02T00:00:00.000Z' }),
      ],
      activeId: 'archived',
      folders: [],
    })

    expect(state.tabs.map((tab) => tab.id)).toEqual(['live'])
    expect(state.activeTabId).toBe('live')
  })
})

describe('live, archived, and trashed lifecycle', () => {
  it('archives the active document, hides it, and selects another live document', () => {
    hydrate({ drafts: [draft('a'), draft('b')], activeId: 'a', folders: [] })
    archiveProject('a')

    const collection = getAuthoritativeDraftCollection()
    expect(collection.drafts.find((item) => item.docId === 'a')?.archived).toBe(true)
    expect(collection.activeId).toBe('b')
    expect(useTabsStore.getState().tabs.map((tab) => tab.id)).toEqual(['b'])
    expect(useTabsStore.getState().activeTabId).toBe('b')
  })

  it('archives the final live document without creating a replacement', () => {
    hydrate({ drafts: [draft('a')], activeId: 'a', folders: [] })
    archiveProject('a')

    expect(getAuthoritativeDraftCollection().drafts).toHaveLength(1)
    expect(getAuthoritativeDraftCollection().activeId).toBeNull()
    expect(useTabsStore.getState().tabs).toEqual([])
    expect(useTabsStore.getState().activeTabId).toBeNull()
  })

  it('trashes the active document, hides it, and selects another live document', () => {
    hydrate({ drafts: [draft('a'), draft('b')], activeId: 'a', folders: [] })
    moveProjectToTrash('a')

    const collection = getAuthoritativeDraftCollection()
    expect(collection.drafts.find((item) => item.docId === 'a')?.deletedAt).toEqual(expect.any(String))
    expect(collection.activeId).toBe('b')
    expect(useTabsStore.getState().tabs.map((tab) => tab.id)).toEqual(['b'])
  })

  it('trashes the final live document without creating a replacement', () => {
    hydrate({ drafts: [draft('a')], activeId: 'a', folders: [] })
    moveProjectToTrash('a')

    expect(getAuthoritativeDraftCollection().drafts).toHaveLength(1)
    expect(getAuthoritativeDraftCollection().activeId).toBeNull()
    expect(useTabsStore.getState().tabs).toEqual([])
  })

  it('restores an archived document to editor eligibility without forcing activation', () => {
    hydrate({
      drafts: [draft('a', { archived: true, archivedAt: '2025-01-01T00:00:00.000Z' })],
      activeId: null,
      folders: [],
    })
    restoreProject('a')

    expect(useTabsStore.getState().tabs.map((tab) => tab.id)).toEqual(['a'])
    expect(useTabsStore.getState().activeTabId).toBeNull()
    expect(getAuthoritativeDraftCollection().activeId).toBeNull()
  })

  it('restores a trashed document to editor eligibility without forcing activation', () => {
    hydrate({
      drafts: [draft('a', { deletedAt: '2025-01-01T00:00:00.000Z' })],
      activeId: null,
      folders: [],
    })
    restoreProjectFromTrash('a')

    expect(useTabsStore.getState().tabs.map((tab) => tab.id)).toEqual(['a'])
    expect(useTabsStore.getState().activeTabId).toBeNull()
  })

  it('permanently deletes a hidden document from the canonical collection', () => {
    hydrate({
      drafts: [draft('a', { deletedAt: '2025-01-01T00:00:00.000Z' })],
      activeId: null,
      folders: [],
    })
    permanentlyDeleteProject('a')

    expect(getAuthoritativeDraftCollection()).toEqual({ drafts: [], activeId: null, folders: [] })
  })

  it('normalizes missing and hidden active IDs to the first live document', () => {
    hydrate({
      drafts: [
        draft('archived', { archived: true, archivedAt: '2025-01-01T00:00:00.000Z' }),
        draft('live'),
      ],
      activeId: 'archived',
      folders: [],
    })
    expect(getAuthoritativeDraftCollection().activeId).toBe('live')
    expect(useTabsStore.getState().activeTabId).toBe('live')

    hydrate({ drafts: [draft('live')], activeId: 'missing', folders: [] })
    expect(getAuthoritativeDraftCollection().activeId).toBe('live')
  })
})
