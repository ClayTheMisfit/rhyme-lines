'use client'

import { create } from 'zustand'
import type {
  DraftPersistenceSnapshot,
  DraftPersistenceStatus,
} from '@/lib/persist/draftCoordinator'

export type AutosaveStatus = DraftPersistenceStatus

type AutosaveState = {
  rev: number
  savedRev: number
  isSaving: boolean
  lastError: string | null
  lastErrorAt: number | null
  status: AutosaveStatus
  lastSavedAt: number | null
  runSave: (() => void) | null
  setRunSave: (fn: (() => void) | null) => void
  syncFromPersistence: (snapshot: DraftPersistenceSnapshot) => void
}

export const useAutosaveStore = create<AutosaveState>((set) => ({
  rev: 0,
  savedRev: 0,
  isSaving: false,
  lastError: null,
  lastErrorAt: null,
  status: 'saved',
  lastSavedAt: null,
  runSave: null,
  setRunSave: (runSave) => set({ runSave }),
  syncFromPersistence: (snapshot) => set({
    rev: snapshot.currentRevision,
    savedRev: snapshot.acknowledgedRevision,
    isSaving: snapshot.status === 'saving',
    lastError: snapshot.lastError,
    lastErrorAt: snapshot.lastErrorAt,
    status: snapshot.status,
    lastSavedAt: snapshot.lastSavedAt,
  }),
}))
