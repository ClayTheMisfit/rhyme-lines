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
import { writeVersioned } from '@/lib/persist/storage'

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
}

interface TabsState {
  tabs: Tab[]
  activeTabId: TabId
  actions: {
    newTab: () => void
    setActive: (id: TabId) => void
    closeTab: (id: TabId) => void
    renameTab: (id: TabId, title: string) => void
    updateSnapshot: (id: TabId, patch: Partial<EditorSnapshot>) => void
    markDirty: (id: TabId, dirty: boolean) => void
    hydrate: (payload: DraftCollection) => void
  }
}

const PERSIST_DEBOUNCE_MS = 250

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
    lines: draftLines.length ? draftLines : [{ id: `${tab.id}-line-0`, text: '' }],
    selection: previousDraft?.selection,
  }
}

const buildDraftCollection = (state: TabsState, previous: DraftCollection | null): DraftCollection => {
  const previousMap = new Map<string, DraftSchema>()
  previous?.drafts.forEach((draft) => {
    previousMap.set(draft.docId, draft)
  })

  const drafts = state.tabs.map((tab) => buildDraftFromTab(tab, previousMap.get(tab.id)))
  const activeId = drafts.find((draft) => draft.docId === state.activeTabId)?.docId ?? drafts[0]?.docId ?? ''

  return {
    drafts,
    activeId,
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
      const tab = createDefaultTab()
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
    renameTab: (id, title) => {
      const normalized = title.trim() || 'Untitled'
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
