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
    if (text == null) {
      set({ preview: null })
      return
    }
    const trimmed = text.trim()
    if (!trimmed) {
      set({ preview: null })
      return
    }
    const normalized = normalizeToken(trimmed)
    if (normalized == null || normalized === '') {
      set({ preview: null })
      return
    }
    set({ preview: { text: trimmed, lowerText: normalized } })
  },
  clearPreview: () => set({ preview: null }),
}))
