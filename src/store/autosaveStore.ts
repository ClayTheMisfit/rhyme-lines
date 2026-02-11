'use client'

import { create } from 'zustand'

export type AutosaveStatus = 'dirty' | 'saving' | 'saved' | 'error'

type AutosaveState = {
  rev: number
  savedRev: number
  isSaving: boolean
  lastError: string | null
  status: AutosaveStatus
  lastSavedAt: number | null
  runSave: (() => void) | null
  setRunSave: (fn: (() => void) | null) => void
  initialize: (revision?: number) => void
  markChanged: () => number
  startSaving: () => number
  completeSaving: (revAtStart: number) => boolean
  failSaving: (message: string) => void
}

const deriveStatus = (state: { isSaving: boolean; rev: number; savedRev: number; lastError: string | null }): AutosaveStatus => {
  if (state.isSaving) return 'saving'
  if (state.lastError) return 'error'
  if (state.rev !== state.savedRev) return 'dirty'
  return 'saved'
}

export const useAutosaveStore = create<AutosaveState>((set, get) => ({
  rev: 0,
  savedRev: 0,
  isSaving: false,
  lastError: null,
  status: 'saved',
  lastSavedAt: null,
  runSave: null,
  setRunSave: (runSave) => set({ runSave }),
  initialize: (revision = 0) =>
    set({
      rev: revision,
      savedRev: revision,
      isSaving: false,
      lastError: null,
      status: 'saved',
      lastSavedAt: Date.now(),
    }),
  markChanged: () => {
    const nextRev = get().rev + 1
    set({
      rev: nextRev,
      status: deriveStatus({ ...get(), rev: nextRev }),
    })
    return nextRev
  },
  startSaving: () => {
    const revAtStart = get().rev
    set((state) => ({
      isSaving: true,
      lastError: null,
      status: deriveStatus({ ...state, isSaving: true, lastError: null }),
    }))
    return revAtStart
  },
  completeSaving: (revAtStart) => {
    const { rev } = get()
    const isLatest = revAtStart === rev
    set((state) => {
      const nextSavedRev = isLatest ? rev : state.savedRev
      return {
        isSaving: false,
        savedRev: nextSavedRev,
        lastError: null,
        lastSavedAt: isLatest ? Date.now() : state.lastSavedAt,
        status: deriveStatus({
          ...state,
          isSaving: false,
          savedRev: nextSavedRev,
          lastError: null,
        }),
      }
    })
    return isLatest
  },
  failSaving: (message) =>
    set((state) => ({
      isSaving: false,
      lastError: message,
      status: deriveStatus({ ...state, isSaving: false, lastError: message }),
    })),
}))
