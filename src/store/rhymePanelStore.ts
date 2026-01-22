"use client"

import { create } from 'zustand'
import { assertClientOnly } from '@/lib/env/assertClientOnly'
import { isClient } from '@/lib/env/isClient'
import { applyRhymePanelState, useRhymePanel, type RhymePanelMode } from '@/lib/state/rhymePanel'
import { DEFAULT_PANEL_STATE, type PanelSchema, type RhymeFilters } from '@/lib/persist/schema'
import { writeVersioned } from '@/lib/persist/storage'

export interface RhymePanelState {
  // Panel visibility
  isOpen: boolean
  
  // UI state
  filters: Record<keyof RhymeFilters, boolean>
  searchQuery: string
  selectedIndex: number | null
  panelWidth: number
  
  // Actions
  togglePanel: () => void
  setFilters: (filters: Record<keyof RhymeFilters, boolean>) => void
  toggleFilter: (quality: keyof RhymeFilters) => void
  setSearchQuery: (query: string) => void
  setSelectedIndex: (index: number | null) => void
  resetSelection: () => void
  setPanelWidth: (width: number) => void
}

const basePanelState = DEFAULT_PANEL_STATE
const initialFilters = basePanelState.filters ?? DEFAULT_PANEL_STATE.filters

export const useRhymePanelStore = create<RhymePanelState>()((set, get) => ({
  isOpen: useRhymePanel.getState().mode !== 'hidden',
  filters: { ...initialFilters },
  searchQuery: basePanelState.searchQuery ?? basePanelState.lastTargetWord ?? '',
  selectedIndex: basePanelState.selectedIndex ?? null,
  panelWidth: basePanelState.rhymePanel.width ?? useRhymePanel.getState().width,

  // Actions
  togglePanel: () => {
    const { isOpen } = get()
    if (isOpen) {
      useRhymePanel.getState().setMode('hidden')
      set({ isOpen: false, selectedIndex: null })
    } else {
      useRhymePanel.getState().setMode('docked')
      set({ isOpen: true, selectedIndex: 0 })
    }
  },
  setFilters: (filters) => set({ filters, selectedIndex: 0 }),
  toggleFilter: (quality) =>
    set((state) => {
      const next = { ...state.filters, [quality]: !state.filters[quality] }
      // Avoid disabling everything
      const enabledCount = Object.values(next).filter(Boolean).length
      if (enabledCount === 0) {
        next[quality] = true
      }
      return { filters: next, selectedIndex: 0 }
    }),
  setSearchQuery: (query) => set({ searchQuery: query, selectedIndex: 0 }),
  setSelectedIndex: (index: number | null) => set({ selectedIndex: index }),
  resetSelection: () => set({ selectedIndex: null }),
  setPanelWidth: (width) => {
    useRhymePanel.getState().setBounds({ width })
    set({ panelWidth: width })
  },
}))

const PANEL_PERSIST_DEBOUNCE_MS = 250
let persistTimer: number | null = null

const buildPanelPersistPayload = (): PanelSchema => {
  const panel = useRhymePanel.getState()
  const filters = useRhymePanelStore.getState()
  return {
    rhymePanel: {
      isOpen: panel.mode !== 'hidden',
      isDetached: panel.mode === 'detached',
      width: panel.width,
      height: panel.height,
      position: { x: panel.x, y: panel.y },
    },
    filters: filters.filters,
    lastTargetWord: filters.searchQuery || undefined,
    searchQuery: filters.searchQuery,
    selectedIndex: filters.selectedIndex,
    syllableFilter: panel.filter,
  }
}

const schedulePersist = () => {
  if (!isClient()) {
    if (process.env.NODE_ENV === 'development') {
      assertClientOnly('panel:persist')
    }
    return
  }
  if (persistTimer) {
    window.clearTimeout(persistTimer)
  }
  persistTimer = window.setTimeout(() => {
    writeVersioned('panel', buildPanelPersistPayload())
    persistTimer = null
  }, PANEL_PERSIST_DEBOUNCE_MS)
}

if (isClient()) {
  useRhymePanel.subscribe((state) => {
    useRhymePanelStore.setState((prev) => ({
      isOpen: state.mode !== 'hidden',
      selectedIndex: state.mode === 'hidden' ? null : prev.selectedIndex ?? 0,
    }))
    schedulePersist()
  })

  useRhymePanel.subscribe((state) => {
    useRhymePanelStore.setState({ panelWidth: state.width })
  })

  useRhymePanelStore.subscribe(() => schedulePersist())
}

export function hydrateRhymePanel(panel: PanelSchema) {
  const filters = panel.filters ?? DEFAULT_PANEL_STATE.filters
  const searchQuery = panel.searchQuery ?? panel.lastTargetWord ?? ''
  const selectedIndex = panel.selectedIndex ?? null
  const panelWidth = panel.rhymePanel.width ?? useRhymePanel.getState().width
  const mode: RhymePanelMode = panel.rhymePanel.isOpen
    ? panel.rhymePanel.isDetached
      ? 'detached'
      : 'docked'
    : 'hidden'

  applyRhymePanelState(panel)

  useRhymePanelStore.setState({
    isOpen: mode !== 'hidden',
    filters,
    searchQuery,
    selectedIndex,
    panelWidth,
  })
}
