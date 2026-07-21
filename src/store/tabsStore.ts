'use client'

import { create } from 'zustand'
import { assertClientOnly } from '@/lib/env/assertClientOnly'
import { isClient } from '@/lib/env/isClient'
import {
  createDefaultDraftCollection,
  createEmptyDraft,
  type DraftCollection,
  type DraftLine,
  type DraftSchema,
} from '@/lib/persist/schema'
import { readWithMigrations, writeVersioned } from '@/lib/persist/storage'

export type TabId = string

export interface EditorSnapshot {
  text: string
}

export interface Tab {
  id: TabId
  title: string
  snapshot: EditorSnapshot
  isDirty: boolean
  createdAt: number
  updatedAt: number
  isPinned: boolean
  position: number
}

interface TabsState {
  tabs: Tab[]
  activeTabId: TabId
  actions: {
    newTab: () => void
    setActive: (id: TabId) => void
    closeTab: (id: TabId) => void
    deleteTab: (id: TabId) => void
    renameTab: (id: TabId, title: string) => void
    pinTab: (id: TabId) => void
    unpinTab: (id: TabId) => void
    moveTab: (id: TabId, direction: -1 | 1) => void
    moveTabToIndex: (id: TabId, targetIndex: number) => void
    updateSnapshot: (id: TabId, patch: Partial<EditorSnapshot>) => void
    markDirty: (id: TabId, dirty: boolean) => void
    hydrate: (payload: DraftCollection) => void
  }
}

const PERSIST_DEBOUNCE_MS = 250

export const MAX_TAB_TITLE_LENGTH = 100

export const getOrderedTabs = (tabs: Tab[]): Tab[] =>
  [...tabs].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    if (a.position !== b.position) return a.position - b.position
    return a.createdAt - b.createdAt
  })

const getNextPosition = (tabs: Tab[], isPinned: boolean) =>
  tabs.filter((tab) => tab.isPinned === isPinned).reduce((max, tab) => Math.max(max, tab.position), 0) + 1000

const normalizeTitle = (title: string, fallback: string) => {
  const trimmed = title.trim()
  return (trimmed || fallback).slice(0, MAX_TAB_TITLE_LENGTH)
}

const reorderGroup = (tabs: Tab[], id: TabId, targetIndex: number): Tab[] => {
  const moving = tabs.find((tab) => tab.id === id)
  if (!moving) return tabs
  const group = getOrderedTabs(tabs).filter((tab) => tab.isPinned === moving.isPinned)
  const fromIndex = group.findIndex((tab) => tab.id === id)
  if (fromIndex === -1) return tabs
  const clampedTarget = Math.max(0, Math.min(targetIndex, group.length - 1))
  if (fromIndex === clampedTarget) return tabs
  const reordered = [...group]
  const [item] = reordered.splice(fromIndex, 1)
  reordered.splice(clampedTarget, 0, item)
  const positionById = new Map(reordered.map((tab, index) => [tab.id, (index + 1) * 1000]))
  const now = Date.now()
  return tabs.map((tab) => {
    const newPosition = positionById.get(tab.id)
    if (!newPosition) return tab
    if (newPosition === tab.position) return tab
    return tab.id === id ? { ...tab, position: newPosition, updatedAt: now } : { ...tab, position: newPosition }
  })
}

const makeId = (): TabId => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `tab-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`
}

const tabFromDraft = (draft: DraftSchema): Tab => ({
  id: draft.docId,
  title: draft.title ?? 'Untitled',
  snapshot: { text: draft.lines.map((line) => line.text).join('\n') },
  isDirty: false,
  createdAt: draft.createdAt,
  updatedAt: draft.updatedAt,
  isPinned: draft.isPinned === true,
  position: typeof draft.position === 'number' ? draft.position : draft.updatedAt,
})

const createDefaultTab = (): Tab => tabFromDraft(createEmptyDraft(makeId()))

const reuseLineId = (existing: DraftLine | undefined, fallback: string) => existing?.id ?? fallback

const buildDraftFromTab = (tab: Tab, previousDraft?: DraftSchema): DraftSchema => {
  const linesFromSnapshot = tab.snapshot.text.split('\n')
  const previousLines = previousDraft?.lines ?? []
  const draftLines = linesFromSnapshot.map((text, index) => ({
    id: reuseLineId(previousLines[index], `${tab.id}-line-${index}`),
    text,
  }))

  return {
    docId: tab.id,
    title: tab.title,
    createdAt: tab.createdAt,
    updatedAt: Date.now(),
    archived: previousDraft?.archived ?? false,
    archivedAt: previousDraft?.archivedAt ?? null,
    deletedAt: previousDraft?.deletedAt ?? null,
    folderId: previousDraft?.folderId ?? null,
    isPinned: tab.isPinned === true,
    position: tab.position,
    lines: draftLines.length ? draftLines : [{ id: `${tab.id}-line-0`, text: '' }],
    selection: previousDraft?.selection,
  }
}

export const buildDraftCollection = (state: Pick<TabsState, 'tabs' | 'activeTabId'>, previous: DraftCollection | null): DraftCollection => {
  const persisted = previous ?? readWithMigrations('drafts').data
  const previousMap = new Map<string, DraftSchema>()
  persisted?.drafts.forEach((draft) => {
    previousMap.set(draft.docId, draft)
  })

  const drafts = state.tabs.map((tab) => buildDraftFromTab(tab, previousMap.get(tab.id)))
  const activeId = drafts.find((draft) => draft.docId === state.activeTabId)?.docId ?? drafts[0]?.docId ?? ''

  return {
    drafts,
    activeId,
    folders: persisted?.folders ?? [],
  }
}

const draftCollectionToTabs = (collection: DraftCollection): { tabs: Tab[]; activeTabId: string } => {
  const tabs = collection.drafts.length ? collection.drafts.map(tabFromDraft) : [createDefaultTab()]
  const fallbackActive = tabs[0]?.id ?? createDefaultTab().id
  const activeTabId = tabs.find((tab) => tab.id === collection.activeId)?.id ?? fallbackActive
  return { tabs, activeTabId }
}

let lastPersistedDrafts: DraftCollection | null = null

const baseDrafts = createDefaultDraftCollection()
lastPersistedDrafts = baseDrafts
const baseTabs = draftCollectionToTabs(baseDrafts)

export const useTabsStore = create<TabsState>()((set, get) => ({
  tabs: baseTabs.tabs,
  activeTabId: baseTabs.activeTabId,
  actions: {
    newTab: () => {
      const tab = { ...createDefaultTab(), position: getNextPosition(get().tabs, false) }
      set((state) => ({
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      }))
    },
    setActive: (id) => {
      const exists = get().tabs.some((tab) => tab.id === id)
      if (!exists) return
      set({ activeTabId: id })
    },
    closeTab: (id) => {
      set((state) => {
        const index = state.tabs.findIndex((tab) => tab.id === id)
        if (index === -1) return state

        const target = state.tabs[index]
        if (target.isDirty && isClient()) {
          const confirmed = window.confirm('Discard unsaved changes for this tab?')
          if (!confirmed) return state
        }

        const nextTabs = state.tabs.filter((tab) => tab.id !== id)
        if (!nextTabs.length) {
          const replacement = createDefaultTab()
          return {
            ...state,
            tabs: [replacement],
            activeTabId: replacement.id,
          }
        }

        let nextActiveId = state.activeTabId
        if (state.activeTabId === id) {
          const neighbor = nextTabs[index - 1] ?? nextTabs[index] ?? nextTabs[0]
          nextActiveId = neighbor.id
        }

        return {
          ...state,
          tabs: nextTabs,
          activeTabId: nextActiveId,
        }
      })
    },

    deleteTab: (id) => {
      set((state) => {
        const ordered = getOrderedTabs(state.tabs)
        const index = ordered.findIndex((tab) => tab.id === id)
        if (index === -1) return state
        const nextTabs = state.tabs.filter((tab) => tab.id !== id)
        if (!nextTabs.length) {
          const replacement = createDefaultTab()
          return { ...state, tabs: [replacement], activeTabId: replacement.id }
        }
        let nextActiveId = state.activeTabId
        if (state.activeTabId === id) {
          const nextVisible = ordered[index + 1] ?? ordered[index - 1]
          nextActiveId = nextTabs.find((tab) => tab.id === nextVisible?.id)?.id ?? nextTabs[0].id
        }
        return { ...state, tabs: nextTabs, activeTabId: nextActiveId }
      })
    },
    renameTab: (id, title) => {
      const existing = get().tabs.find((tab) => tab.id === id)
      const normalized = normalizeTitle(title, existing?.title || 'Untitled')
      set((state) => ({
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === id
            ? {
                ...tab,
                title: normalized,
                updatedAt: Date.now(),
              }
            : tab
        ),
      }))
    },
    pinTab: (id) => {
      set((state) => ({
        ...state,
        tabs: state.tabs.map((tab) => tab.id === id ? { ...tab, isPinned: true, position: getNextPosition(state.tabs, true), updatedAt: Date.now() } : tab),
      }))
    },
    unpinTab: (id) => {
      set((state) => ({
        ...state,
        tabs: state.tabs.map((tab) => tab.id === id ? { ...tab, isPinned: false, position: getNextPosition(state.tabs, false), updatedAt: Date.now() } : tab),
      }))
    },
    moveTab: (id, direction) => {
      set((state) => {
        const moving = state.tabs.find((tab) => tab.id === id)
        if (!moving) return state
        const group = getOrderedTabs(state.tabs).filter((tab) => tab.isPinned === moving.isPinned)
        const index = group.findIndex((tab) => tab.id === id)
        return { ...state, tabs: reorderGroup(state.tabs, id, index + direction) }
      })
    },
    moveTabToIndex: (id, targetIndex) => {
      set((state) => ({ ...state, tabs: reorderGroup(state.tabs, id, targetIndex) }))
    },
    updateSnapshot: (id, patch) => {
      set((state) => ({
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === id
            ? {
                ...tab,
                snapshot: {
                  ...tab.snapshot,
                  ...patch,
                },
                updatedAt: Date.now(),
              }
            : tab
        ),
      }))
    },
    markDirty: (id, dirty) => {
      set((state) => ({
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === id
            ? {
                ...tab,
                isDirty: dirty,
                updatedAt: dirty ? Date.now() : tab.updatedAt,
              }
            : tab
        ),
      }))
    },
    hydrate: (payload) => {
      const safeDrafts = payload ?? createDefaultDraftCollection()
      lastPersistedDrafts = safeDrafts
      const hydrated = draftCollectionToTabs(safeDrafts)
      set((state) => ({
        ...state,
        tabs: hydrated.tabs,
        activeTabId: hydrated.activeTabId,
      }))
    },
  },
}))

const persistState = (state: TabsState) => {
  if (!isClient()) {
    if (process.env.NODE_ENV === 'development') {
      assertClientOnly('tabs:persist')
    }
    return
  }
  const payload = buildDraftCollection(state, lastPersistedDrafts)
  writeVersioned('drafts', payload)
  lastPersistedDrafts = payload
}

if (isClient()) {
  let timer: number | null = null
  useTabsStore.subscribe((state) => {
    if (timer) {
      window.clearTimeout(timer)
    }
    timer = window.setTimeout(() => {
      persistState(state)
      timer = null
    }, PERSIST_DEBOUNCE_MS)
  })
}

export const getActiveTab = (): Tab => {
  const state = useTabsStore.getState()
  const active = state.tabs.find((tab) => tab.id === state.activeTabId)
  return active ?? state.tabs[0]
}

export function hydrateTabsFromPersisted(drafts: DraftCollection) {
  useTabsStore.getState().actions.hydrate(drafts)
}

export function getLastPersistedDraftCollection(): DraftCollection | null {
  return lastPersistedDrafts
}
