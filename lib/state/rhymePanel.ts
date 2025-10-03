"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type SyllableFilter = 0 | 1 | 2 | 3 | 4 | 5

type RhymePanelState = {
  isOpen: boolean
  isFloating: boolean
  filter: SyllableFilter
  x: number
  y: number
  width: number
  height: number
  open: () => void
  close: () => void
  toggle: () => void
  dock: () => void
  undock: () => void
  setFilter: (f: SyllableFilter) => void
  setBounds: (b: Partial<Pick<RhymePanelState, "x" | "y" | "width" | "height">>) => void
}

export const useRhymePanel = create<RhymePanelState>()(
  persist(
    (set) => ({
      isOpen: true,
      isFloating: false,
      filter: 0,
      x: 96,
      y: 96,
      width: 360,
      height: 560,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      dock: () => set({ isFloating: false }),
      undock: () => set({ isFloating: true }),
      setFilter: (filter) => set({ filter }),
      setBounds: (bounds) =>
        set((state) => ({
          ...state,
          ...bounds,
        })),
    }),
    { name: "rhyme-lines:ui:rhyme-panel" }
  )
)
