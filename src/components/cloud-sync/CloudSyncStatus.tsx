'use client'

import { useCloudSyncStore } from '@/store/cloudSyncStore'
import type { CloudSyncState } from '@/lib/cloud-sync/metadata'

const aggregateState = (states: CloudSyncState[]): CloudSyncState | undefined => {
  const priority: CloudSyncState[] = ['conflict', 'auth-required', 'account-switch', 'error', 'offline', 'syncing', 'pending', 'synced']
  return priority.find((state) => states.includes(state))
}

export function CloudSyncStatus({ documentId }: { documentId?: string | null }) {
  const accountState = useCloudSyncStore((state) => state.accountState)
  const documentState = useCloudSyncStore((state) => documentId ? state.documentStates[documentId] : undefined)
  const workspaceState = useCloudSyncStore((state) => documentId ? undefined : aggregateState(Object.values(state.documentStates)))
  const syncState = documentState ?? workspaceState

  const label = accountState === 'anonymous'
    ? 'Cloud: Sign in to sync'
    : accountState === 'account-switch'
      ? 'Cloud: Account changed'
      : accountState === 'auth-required'
        ? 'Cloud: Sign in again'
        : accountState === 'error'
          ? 'Cloud: Unavailable'
          : syncState === 'conflict'
            ? 'Cloud: Sync conflict'
            : syncState === 'offline'
              ? 'Cloud: Offline'
              : syncState === 'syncing' || syncState === 'pending'
                ? 'Cloud: Syncing'
                : syncState === 'synced'
                  ? 'Cloud: Synced'
                  : syncState === 'error'
                    ? 'Cloud: Sync paused'
                    : accountState === 'ready'
                      ? 'Cloud: Ready'
                      : 'Cloud: Checking…'

  const urgent = syncState === 'conflict' || accountState === 'account-switch'
  return <span role="status" aria-live="polite" className={urgent ? 'text-amber-300/90' : undefined}>{label}</span>
}
