import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
      isOpen: false,
      activeTab: 'perfect',
      searchQuery: '',
      selectedIndex: 0,
      panelWidth: 320,

      // Actions
      togglePanel: () => set((state) => ({ 
        isOpen: !state.isOpen, 
        selectedIndex: 0 
      })),
      
      setActiveTab: (tab) => set({ activeTab: tab, selectedIndex: 0 }),
      setSearchQuery: (query) => set({ searchQuery: query, selectedIndex: 0 }),
      setSelectedIndex: (index) => set({ selectedIndex: index }),
      resetSelection: () => set({ selectedIndex: 0 }),
      setPanelWidth: (width) => set({ panelWidth: width }),
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
