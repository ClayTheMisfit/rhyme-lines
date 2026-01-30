"use client"

import { create } from 'zustand'
import { normalizeToken } from '@/lib/rhyme-db/normalizeToken'

export type RhymePreview = { text: string; lowerText: string } | null

type RhymeHighlightState = {
  preview: RhymePreview
  setPreview: (text: string | null) => void
  clearPreview: () => void
}

export const useRhymeHighlightStore = create<RhymeHighlightState>()((set) => ({
  preview: null,
  setPreview: (text) => {
    const normalized = text ? normalizeToken(text) : ''
    if (!normalized) {
      set({ preview: null })
      return
    }
    set({ preview: { text, lowerText: normalized } })
  },
  clearPreview: () => set({ preview: null }),
}))
