'use client'

import { createWithEqualityFn } from 'zustand/traditional'
import { isClient } from '@/lib/env/isClient'

export type EditorDensityMode = 'draft' | 'analysis'

const STORAGE_KEY = 'rhyme-lines:editor-density-mode'

const readInitialMode = (): EditorDensityMode => {
  if (!isClient()) return 'draft'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'analysis' ? 'analysis' : 'draft'
  } catch {
    return 'draft'
  }
}

type EditorDensityStore = {
  mode: EditorDensityMode
  setMode: (mode: EditorDensityMode) => void
}

export const useEditorDensityStore = createWithEqualityFn<EditorDensityStore>()(
  (set) => ({
    mode: readInitialMode(),
    setMode: (mode) => {
      set({ mode })
      if (!isClient()) return
      try {
        window.localStorage.setItem(STORAGE_KEY, mode)
      } catch {
        // ignore localStorage failures
      }
    },
  }),
  Object.is
)
