'use client'

import { create } from 'zustand'
import type { CloudSyncState } from '@/lib/cloud-sync/metadata'

export type CloudAccountState = 'checking' | 'anonymous' | 'ready' | 'auth-required' | 'account-switch' | 'error'

type CloudSyncStore = {
  accountState: CloudAccountState
  documentStates: Record<string, CloudSyncState>
  actions: {
    setAccountState: (state: CloudAccountState) => void
    setDocumentState: (id: string, state: CloudSyncState) => void
    replaceDocumentStates: (states: Record<string, CloudSyncState>) => void
    reset: () => void
  }
}

export const useCloudSyncStore = create<CloudSyncStore>()((set) => ({
  accountState: 'checking',
  documentStates: {},
  actions: {
    setAccountState: (accountState) => set({ accountState }),
    setDocumentState: (id, state) => set((current) => ({
      documentStates: { ...current.documentStates, [id]: state },
    })),
    replaceDocumentStates: (documentStates) => set({ documentStates }),
    reset: () => set({ accountState: 'checking', documentStates: {} }),
  },
}))
