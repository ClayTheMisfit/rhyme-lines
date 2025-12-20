"use client"

import { create } from "zustand"
import { DEFAULT_PANEL_STATE } from "@/lib/persist/schema"
import { readWithMigrations } from "@/lib/persist/storage"

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

const basePanel = typeof window === "undefined" ? DEFAULT_PANEL_STATE : readWithMigrations("panel").data
const basePosition = basePanel.rhymePanel.position ?? DEFAULT_PANEL_STATE.rhymePanel.position ?? { x: 96, y: 96 }

export const useRhymePanel = create<RhymePanelState>()((set) => ({
  mode: basePanel.rhymePanel.isOpen ? (basePanel.rhymePanel.isDetached ? "detached" : "docked") : "hidden",
  filter: (basePanel.syllableFilter ?? DEFAULT_PANEL_STATE.syllableFilter ?? 0) as SyllableFilter,
  x: basePosition?.x ?? 96,
  y: basePosition?.y ?? 96,
  width: basePanel.rhymePanel.width ?? DEFAULT_PANEL_STATE.rhymePanel.width,
  height: basePanel.rhymePanel.height ?? DEFAULT_PANEL_STATE.rhymePanel.height ?? 560,
  setMode: (mode) => set({ mode }),
  dock: () => set({ mode: "docked" }),
  undock: () => set({ mode: "detached" }),
  setFilter: (filter) => set({ filter }),
  setBounds: (bounds) =>
    set((state) => ({
      ...state,
      ...bounds,
    })),
}))
