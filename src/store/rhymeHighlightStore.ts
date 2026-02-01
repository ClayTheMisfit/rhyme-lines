'use client'

import { create } from 'zustand'
import { ColorRegistry } from '@/lib/rhyme/colorRegistry'

export type RhymeHighlightState = {
  activeRhymeGroupKey: string | null
  focusLocked: boolean
  colorRegistries: Map<string, ColorRegistry>
  setActiveRhymeGroupKey: (key: string | null) => void
  setFocusLocked: (locked: boolean) => void
  getColorRegistry: (docId: string) => ColorRegistry
  clearFocus: () => void
}

export const useRhymeHighlightStore = create<RhymeHighlightState>()((set, get) => ({
  activeRhymeGroupKey: null,
  focusLocked: false,
  colorRegistries: new Map(),
  setActiveRhymeGroupKey: (key) => set({ activeRhymeGroupKey: key }),
  setFocusLocked: (focusLocked) => set({ focusLocked }),
  getColorRegistry: (docId) => {
    const current = get().colorRegistries
    const existing = current.get(docId)
    if (existing) return existing
    const registry = new ColorRegistry()
    const next = new Map(current)
    next.set(docId, registry)
    set({ colorRegistries: next })
    return registry
  },
  clearFocus: () => set({ activeRhymeGroupKey: null, focusLocked: false }),
}))
