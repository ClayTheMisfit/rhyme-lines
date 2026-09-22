'use client'

import { create } from 'zustand'
import type { CloudSyncState } from '@/lib/cloud-sync/metadata'

export type CloudAccountState = 'checking' | 'anonymous' | 'ready' | 'auth-required' | 'account-switch' | 'error'

type CloudSyncStore = {
  accountState: CloudAccountState
  documentStates: Record<string, CloudSyncState>
  conflictDialogDocumentId: string | null
  actions: {
    setAccountState: (state: CloudAccountState) => void
    setDocumentState: (id: string, state: CloudSyncState) => void
    replaceDocumentStates: (states: Record<string, CloudSyncState>) => void
    openConflictDialog: (documentId: string) => void
    closeConflictDialog: () => void
    reset: () => void
  }
}

export const useCloudSyncStore = create<CloudSyncStore>()((set) => ({
  accountState: 'checking',
  documentStates: {},
  conflictDialogDocumentId: null,
  actions: {
    setAccountState: (accountState) => set((current) => ({
      accountState,
      conflictDialogDocumentId: accountState === 'ready' ? current.conflictDialogDocumentId : null,
    })),
    setDocumentState: (id, state) => set((current) => ({
      documentStates: { ...current.documentStates, [id]: state },
    })),
    replaceDocumentStates: (documentStates) => set({ documentStates }),
    openConflictDialog: (conflictDialogDocumentId) => set({ conflictDialogDocumentId }),
    closeConflictDialog: () => set({ conflictDialogDocumentId: null }),
    reset: () => set({ accountState: 'checking', documentStates: {}, conflictDialogDocumentId: null }),
  },
}))
