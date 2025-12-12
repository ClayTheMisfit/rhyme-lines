"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type SyllableFilter = 0 | 1 | 2 | 3 | 4 | 5

export type RhymePanelMode = "hidden" | "docked" | "detached"

type RhymePanelState = {
  mode: RhymePanelMode
  filter: SyllableFilter
  x: number
  y: number
  width: number
  height: number
  setMode: (mode: RhymePanelMode) => void
  dock: () => void
  undock: () => void
  setFilter: (f: SyllableFilter) => void
  setBounds: (b: Partial<Pick<RhymePanelState, "x" | "y" | "width" | "height">>) => void
}

export const useRhymePanel = create<RhymePanelState>()(
  persist(
    (set) => ({
      mode: "hidden",
      filter: 0,
      x: 96,
      y: 96,
      width: 360,
      height: 560,
      setMode: (mode) => set({ mode }),
      dock: () => set({ mode: "docked" }),
      undock: () => set({ mode: "detached" }),
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
