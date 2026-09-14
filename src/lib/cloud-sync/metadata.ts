'use client'

import { isClient } from '@/lib/env/isClient'
import type { CloudDocumentLifecycle } from './contracts'

export const CLOUD_SYNC_STORAGE_KEY = 'rhyme-lines:cloud-sync:v1'

export type CloudSyncState =
  | 'local-only'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error'
  | 'conflict'
  | 'auth-required'
  | 'account-switch'
  | 'deleted'

export type DocumentSyncMetadata = {
  cloudDocumentId: string | null
  lastKnownServerRevision: number | null
  lastKnownLifecycle: CloudDocumentLifecycle | null
  lastSuccessfulSyncAt: number | null
  lastSyncedLocalVersion: string | null
  state: CloudSyncState
  lastError: string | null
  attempts: number
  nextRetryAt: number | null
  pendingPermanentDelete: boolean
}

export type AccountSyncMetadata = {
  initialized: boolean
  associations: Record<string, DocumentSyncMetadata>
}

export type CloudSyncMetadata = {
  version: 1
  lastAccountId: string | null
  accounts: Record<string, AccountSyncMetadata>
}

const emptyRoot = (): CloudSyncMetadata => ({ version: 1, lastAccountId: null, accounts: {} })

export const emptyDocumentMetadata = (): DocumentSyncMetadata => ({
  cloudDocumentId: null,
  lastKnownServerRevision: null,
  lastKnownLifecycle: null,
  lastSuccessfulSyncAt: null,
  lastSyncedLocalVersion: null,
  state: 'local-only',
  lastError: null,
  attempts: 0,
  nextRetryAt: null,
  pendingPermanentDelete: false,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function readCloudSyncMetadata(): CloudSyncMetadata {
  if (!isClient()) return emptyRoot()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CLOUD_SYNC_STORAGE_KEY) ?? 'null') as unknown
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.accounts)) return emptyRoot()
    const root = emptyRoot()
    root.lastAccountId = typeof parsed.lastAccountId === 'string' ? parsed.lastAccountId : null
    for (const [accountId, value] of Object.entries(parsed.accounts)) {
      if (!isRecord(value) || !isRecord(value.associations)) continue
      const associations: Record<string, DocumentSyncMetadata> = {}
      for (const [localId, raw] of Object.entries(value.associations)) {
        if (!isRecord(raw)) continue
        const base = emptyDocumentMetadata()
        associations[localId] = {
          ...base,
          cloudDocumentId: typeof raw.cloudDocumentId === 'string' ? raw.cloudDocumentId : null,
          lastKnownServerRevision: Number.isInteger(raw.lastKnownServerRevision) ? raw.lastKnownServerRevision as number : null,
          lastKnownLifecycle: raw.lastKnownLifecycle === 'ACTIVE'
            || raw.lastKnownLifecycle === 'ARCHIVED'
            || raw.lastKnownLifecycle === 'TRASHED'
            || raw.lastKnownLifecycle === 'DELETED'
            ? raw.lastKnownLifecycle
            : null,
          lastSuccessfulSyncAt: typeof raw.lastSuccessfulSyncAt === 'number' ? raw.lastSuccessfulSyncAt : null,
          lastSyncedLocalVersion: typeof raw.lastSyncedLocalVersion === 'string' ? raw.lastSyncedLocalVersion : null,
          state: typeof raw.state === 'string' ? raw.state as CloudSyncState : base.state,
          lastError: typeof raw.lastError === 'string' ? raw.lastError : null,
          attempts: Number.isInteger(raw.attempts) ? Math.max(0, raw.attempts as number) : 0,
          nextRetryAt: typeof raw.nextRetryAt === 'number' ? raw.nextRetryAt : null,
          pendingPermanentDelete: raw.pendingPermanentDelete === true,
        }
      }
      root.accounts[accountId] = { initialized: value.initialized === true, associations }
    }
    return root
  } catch {
    return emptyRoot()
  }
}

export function writeCloudSyncMetadata(metadata: CloudSyncMetadata): boolean {
  if (!isClient()) return false
  try {
    window.localStorage.setItem(CLOUD_SYNC_STORAGE_KEY, JSON.stringify(metadata))
    return true
  } catch {
    return false
  }
}

export const ensureAccountMetadata = (root: CloudSyncMetadata, accountId: string): AccountSyncMetadata => {
  root.accounts[accountId] ??= { initialized: false, associations: {} }
  return root.accounts[accountId]
}
