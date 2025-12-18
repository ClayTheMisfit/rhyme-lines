'use client'

import { create } from 'zustand'
import { migrateOldContent } from '@/lib/editor/serialization'

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
    hydrate: () => void
  }
}

const STORAGE_KEY = 'rhyme-lines.tabs.v1'
const LEGACY_STORAGE_KEY = 'rhyme-lines:doc:current:v2'
const LEGACY_STORAGE_KEY_V1 = 'rhyme-lines:doc:current'
const PERSIST_DEBOUNCE_MS = 200

const makeId = (): TabId => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `tab-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`
}

const createDefaultTab = (): Tab => {
  const now = Date.now()
  return {
    id: makeId(),
    title: 'Untitled',
    snapshot: {
      text: '',
    },
    isDirty: false,
    createdAt: now,
    updatedAt: now,
  }
}

type PersistShape = Pick<TabsState, 'tabs' | 'activeTabId'>

const isTabLike = (value: unknown): value is Tab => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    candidate.snapshot !== undefined &&
    typeof (candidate.snapshot as { text?: unknown }).text === 'string' &&
    typeof candidate.isDirty === 'boolean' &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.updatedAt === 'number'
  )
}

const safeParsePersisted = (raw: string | null): PersistShape | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const payload = parsed as Record<string, unknown>
    const maybeTabs = payload.tabs
    const maybeActiveId = payload.activeTabId
    if (!Array.isArray(maybeTabs) || typeof maybeActiveId !== 'string') return null

    const validTabs = maybeTabs.filter(isTabLike) as Tab[]
    if (!validTabs.length) return null
    return {
      tabs: validTabs,
      activeTabId: maybeActiveId,
    }
  } catch {
    return null
  }
}

const readLegacyTab = (): Tab | null => {
  if (typeof window === 'undefined') return null
  let legacyContent = window.localStorage.getItem(LEGACY_STORAGE_KEY)

  if (!legacyContent) {
    const oldContent = window.localStorage.getItem(LEGACY_STORAGE_KEY_V1)
    if (oldContent) {
      legacyContent = migrateOldContent(oldContent)
    }
  }

  if (!legacyContent) return null

  const now = Date.now()
  return {
    id: makeId(),
    title: 'Untitled',
    snapshot: {
      text: legacyContent,
    },
    isDirty: false,
    createdAt: now,
    updatedAt: now,
  }
}

const baseTab = createDefaultTab()

export const useTabsStore = create<TabsState>()((set, get) => ({
  tabs: [baseTab],
  activeTabId: baseTab.id,
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
        if (target.isDirty && typeof window !== 'undefined') {
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
    hydrate: () => {
      if (typeof window === 'undefined') return
      const parsed = safeParsePersisted(window.localStorage.getItem(STORAGE_KEY))
      if (!parsed) {
        const legacy = readLegacyTab()
        if (!legacy) return
        set((state) => ({
          ...state,
          tabs: [legacy],
          activeTabId: legacy.id,
        }))
        return
      }

      const tabs = parsed.tabs.length ? parsed.tabs : [createDefaultTab()]
      const active = tabs.find((tab) => tab.id === parsed.activeTabId)?.id ?? tabs[0].id
      set((state) => ({
        ...state,
        tabs,
        activeTabId: active,
      }))
    },
  },
}))

const persistState = (state: TabsState) => {
  if (typeof window === 'undefined') return
  const payload: PersistShape = {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

if (typeof window !== 'undefined') {
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
