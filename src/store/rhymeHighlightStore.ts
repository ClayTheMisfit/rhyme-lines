'use client'

import { create } from 'zustand'

export type RhymeHighlightState = {
  activeRhymeGroupKey: string | null
  focusLocked: boolean
  setActiveRhymeGroupKey: (key: string | null) => void
  setFocusLocked: (locked: boolean) => void
  clearFocus: () => void
}

export const useRhymeHighlightStore = create<RhymeHighlightState>()((set) => ({
  activeRhymeGroupKey: null,
  focusLocked: false,
  setActiveRhymeGroupKey: (key) => set({ activeRhymeGroupKey: key }),
  setFocusLocked: (focusLocked) => set({ focusLocked }),
  clearFocus: () => set({ activeRhymeGroupKey: null, focusLocked: false }),
}))
