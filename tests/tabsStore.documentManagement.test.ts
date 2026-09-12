import { buildDraftCollection, getOrderedTabs, useTabsStore } from '@/store/tabsStore'
import type { DraftCollection } from '@/lib/persist/schema'
import { getDraftPersistenceRevision } from '@/lib/persist/draftCoordinator'

const makeDraft = (id: string, title: string, updatedAt: number, extra = {}) => ({
  docId: id,
  title,
  createdAt: updatedAt,
  updatedAt,
  lines: [{ id: `${id}-line-0`, text: title }],
  ...extra,
})

const hydrate = (drafts: DraftCollection['drafts'], activeId: string | null = drafts[0]?.docId ?? null) => {
  useTabsStore.getState().actions.hydrate({ drafts, activeId, folders: [] })
}

describe('tabs document management', () => {
  beforeEach(() => {
    hydrate([makeDraft('a', 'Alpha', 1000), makeDraft('b', 'Beta', 2000), makeDraft('c', 'Gamma', 3000)], 'a')
  })

  it('renames only the selected document and rejects blank names by preserving the old title', () => {
    useTabsStore.getState().actions.renameTab('b', '  Better Beta  ')
    expect(useTabsStore.getState().tabs.map((tab) => tab.title)).toEqual(['Alpha', 'Better Beta', 'Gamma'])

    useTabsStore.getState().actions.renameTab('b', '   ')
    expect(useTabsStore.getState().tabs.find((tab) => tab.id === 'b')?.title).toBe('Better Beta')
  })

  it('pins, unpins, and preserves manual order within both groups', () => {
    const actions = useTabsStore.getState().actions
    actions.pinTab('c')
    actions.pinTab('a')
    expect(getOrderedTabs(useTabsStore.getState().tabs).map((tab) => tab.id)).toEqual(['c', 'a', 'b'])

    actions.moveTab('a', -1)
    expect(getOrderedTabs(useTabsStore.getState().tabs).map((tab) => tab.id)).toEqual(['a', 'c', 'b'])

    actions.unpinTab('a')
    expect(getOrderedTabs(useTabsStore.getState().tabs).map((tab) => tab.id)).toEqual(['c', 'b', 'a'])
  })

  it('serializes order and pin state for persistence', () => {
    const actions = useTabsStore.getState().actions
    actions.pinTab('b')
    actions.moveTabToIndex('c', 0)
    const collection = buildDraftCollection(useTabsStore.getState(), null)

    expect(collection.drafts.find((draft) => draft.docId === 'b')?.isPinned).toBe(true)
    expect(collection.drafts.find((draft) => draft.docId === 'c')?.position).toBeLessThan(
      collection.drafts.find((draft) => draft.docId === 'a')?.position ?? 0
    )
  })

  it('does not advance an untouched document timestamp when another document changes', () => {
    const previous: DraftCollection = {
      drafts: [makeDraft('a', 'Alpha', 1000), makeDraft('b', 'Beta', 2000)],
      activeId: 'a',
      folders: [],
    }
    hydrate(previous.drafts, 'a')

    useTabsStore.getState().actions.updateSnapshot('a', { text: 'Alpha changed' })
    const collection = buildDraftCollection(useTabsStore.getState(), previous)

    expect(collection.drafts.find((draft) => draft.docId === 'a')?.updatedAt).toBeGreaterThan(1000)
    expect(collection.drafts.find((draft) => draft.docId === 'b')?.updatedAt).toBe(2000)
  })

  it('clears all persisted dirty markers without creating another collection revision', () => {
    const actions = useTabsStore.getState().actions
    actions.markDirty('a', true)
    actions.markDirty('b', true)
    const before = getDraftPersistenceRevision()

    actions.markAllClean()

    expect(useTabsStore.getState().tabs.every((tab) => !tab.isDirty)).toBe(true)
    expect(getDraftPersistenceRevision()).toEqual(before)
  })

  it('deletes the active document and selects the next visible document', () => {
    useTabsStore.getState().actions.setActive('b')
    useTabsStore.getState().actions.deleteTab('b')
    expect(useTabsStore.getState().tabs.map((tab) => tab.id)).toEqual(['a', 'c'])
    expect(useTabsStore.getState().activeTabId).toBe('c')
  })

  it('deleting the final document leaves an empty collection and old autosave snapshots do not recreate it', () => {
    hydrate([makeDraft('solo', 'Solo', 1000)], 'solo')
    useTabsStore.getState().actions.deleteTab('solo')
    const state = useTabsStore.getState()
    expect(state.tabs).toEqual([])
    expect(state.activeTabId).toBeNull()

    const collection = buildDraftCollection(state, { drafts: [makeDraft('solo', 'Solo', 1000)], activeId: 'solo', folders: [] })
    expect(collection.drafts.map((draft) => draft.docId)).not.toContain('solo')
    expect(collection.activeId).toBeNull()
  })

  it('migrates old drafts without pin or position fields safely', () => {
    hydrate([makeDraft('old', 'Old', 1234)], 'old')
    const tab = useTabsStore.getState().tabs[0]
    expect(tab.isPinned).toBe(false)
    expect(tab.position).toBe(1234)
  })
})
