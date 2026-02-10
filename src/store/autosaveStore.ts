'use client'

import { create } from 'zustand'

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'offline'

type AutosaveState = {
  status: AutosaveStatus
  lastSavedAt: number | null
  errorMessage: string | null
  runSave: (() => void) | null
  setStatus: (status: AutosaveStatus) => void
  setLastSavedAt: (timestamp: number | null) => void
  setErrorMessage: (message: string | null) => void
  setRunSave: (fn: (() => void) | null) => void
}

export const useAutosaveStore = create<AutosaveState>((set) => ({
  status: 'idle',
  lastSavedAt: null,
  errorMessage: null,
  runSave: null,
  setStatus: (status) => set({ status }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setRunSave: (runSave) => set({ runSave }),
}))
