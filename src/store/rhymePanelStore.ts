"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import type { RhymeQuality } from '@/lib/rhyme/aggregate'

export interface RhymePanelState {
  // Panel visibility
  isOpen: boolean
  
  // UI state
  filters: Record<RhymeQuality, boolean>
  searchQuery: string
  selectedIndex: number | null
  panelWidth: number
  
  // Actions
  togglePanel: () => void
  setFilters: (filters: Record<RhymeQuality, boolean>) => void
  toggleFilter: (quality: RhymeQuality) => void
  setSearchQuery: (query: string) => void
  setSelectedIndex: (index: number | null) => void
  resetSelection: () => void
  setPanelWidth: (width: number) => void
}

export const useRhymePanelStore = create<RhymePanelState>()(
  persist(
    (set, get) => ({
      // Initial state
      isOpen: useRhymePanel.getState().mode !== 'hidden',
      filters: { perfect: true, near: true, slant: true },
      searchQuery: '',
      selectedIndex: null,
      panelWidth: useRhymePanel.getState().width,

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
    }),
    {
      name: 'rhyme-panel-store',
      partialize: (state) => ({
        isOpen: state.isOpen,
        panelWidth: state.panelWidth,
        filters: state.filters,
      }),
    }
  )
)

if (typeof window !== 'undefined') {
  useRhymePanel.subscribe((state) => {
    useRhymePanelStore.setState((prev) => ({
      isOpen: state.mode !== 'hidden',
      selectedIndex: state.mode === 'hidden' ? null : prev.selectedIndex ?? 0,
    }))
  })

  useRhymePanel.subscribe((state) => {
    useRhymePanelStore.setState({ panelWidth: state.width })
  })
}
