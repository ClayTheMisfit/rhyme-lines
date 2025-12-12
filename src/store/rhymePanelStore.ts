"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useRhymePanel } from '@/lib/state/rhymePanel'

export type RhymeType = 'perfect' | 'slant'

export interface RhymePanelState {
  // Panel visibility
  isOpen: boolean
  
  // UI state
  activeTab: RhymeType
  searchQuery: string
  selectedIndex: number | null
  panelWidth: number
  
  // Actions
  togglePanel: () => void
  setActiveTab: (tab: RhymeType) => void
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
      activeTab: 'perfect',
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

      setActiveTab: (tab) => set({ activeTab: tab, selectedIndex: 0 }),
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
        activeTab: state.activeTab,
        panelWidth: state.panelWidth,
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
