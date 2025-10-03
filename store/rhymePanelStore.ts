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
  selectedIndex: number
  panelWidth: number
  
  // Actions
  togglePanel: () => void
  setActiveTab: (tab: RhymeType) => void
  setSearchQuery: (query: string) => void
  setSelectedIndex: (index: number) => void
  resetSelection: () => void
  setPanelWidth: (width: number) => void
}

export const useRhymePanelStore = create<RhymePanelState>()(
  persist(
    (set, get) => ({
      // Initial state
      isOpen: useRhymePanel.getState().isOpen,
      activeTab: 'perfect',
      searchQuery: '',
      selectedIndex: 0,
      panelWidth: useRhymePanel.getState().width,

      // Actions
      togglePanel: () => {
        const { isOpen } = get()
        if (isOpen) {
          useRhymePanel.getState().close()
          set({ isOpen: false, selectedIndex: 0 })
        } else {
          useRhymePanel.getState().open()
          set({ isOpen: true, selectedIndex: 0 })
        }
      },

      setActiveTab: (tab) => set({ activeTab: tab, selectedIndex: 0 }),
      setSearchQuery: (query) => set({ searchQuery: query, selectedIndex: 0 }),
      setSelectedIndex: (index) => set({ selectedIndex: index }),
      resetSelection: () => set({ selectedIndex: 0 }),
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
    useRhymePanelStore.setState({ isOpen: state.isOpen })
    if (!state.isOpen) {
      useRhymePanelStore.setState({ selectedIndex: 0 })
    }
  })

  useRhymePanel.subscribe((state) => {
    useRhymePanelStore.setState({ panelWidth: state.width })
  })
}
