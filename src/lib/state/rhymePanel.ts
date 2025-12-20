"use client"

import { create } from "zustand"
import { DEFAULT_PANEL_STATE, type PanelSchema } from "@/lib/persist/schema"

export type SyllableFilter = 0 | 1 | 2 | 3 | 4 | 5

export type RhymePanelMode = "hidden" | "docked" | "detached"

export type RhymePanelState = {
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

const basePosition = DEFAULT_PANEL_STATE.rhymePanel.position ?? { x: 96, y: 96 }

export const useRhymePanel = create<RhymePanelState>()((set) => ({
  mode: DEFAULT_PANEL_STATE.rhymePanel.isOpen
    ? (DEFAULT_PANEL_STATE.rhymePanel.isDetached ? "detached" : "docked")
    : "hidden",
  filter: (DEFAULT_PANEL_STATE.syllableFilter ?? 0) as SyllableFilter,
  x: basePosition?.x ?? 96,
  y: basePosition?.y ?? 96,
  width: DEFAULT_PANEL_STATE.rhymePanel.width,
  height: DEFAULT_PANEL_STATE.rhymePanel.height ?? 560,
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

export function applyRhymePanelState(panel: PanelSchema) {
  const nextMode: RhymePanelMode = panel.rhymePanel.isOpen
    ? (panel.rhymePanel.isDetached ? "detached" : "docked")
    : "hidden"
  const nextPosition = panel.rhymePanel.position ?? DEFAULT_PANEL_STATE.rhymePanel.position ?? { x: 96, y: 96 }

  useRhymePanel.setState({
    mode: nextMode,
    filter: (panel.syllableFilter ?? DEFAULT_PANEL_STATE.syllableFilter ?? 0) as SyllableFilter,
    x: nextPosition.x,
    y: nextPosition.y,
    width: panel.rhymePanel.width ?? DEFAULT_PANEL_STATE.rhymePanel.width,
    height: panel.rhymePanel.height ?? DEFAULT_PANEL_STATE.rhymePanel.height ?? 560,
  })
}
