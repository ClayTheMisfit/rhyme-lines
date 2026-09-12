'use client'

import { isClient } from '@/lib/env/isClient'
import { type DraftCollection } from '@/lib/persist/schema'
import { readWithMigrations, tryWriteVersioned } from '@/lib/persist/storage'
import { normalizeDraftCollectionLifecycle } from '@/lib/projects/lifecycle'

export type DraftPersistenceResult =
  | { ok: true; revision: number; wrote: boolean }
  | { ok: false; revision: number; error: string }

export type DraftPersistenceStatus = 'saved' | 'dirty' | 'saving' | 'error'

export type DraftPersistenceSnapshot = {
  currentRevision: number
  acknowledgedRevision: number
  status: DraftPersistenceStatus
  lastError: string | null
  lastErrorAt: number | null
  lastSavedAt: number | null
}

export type DraftPersistenceEvent =
  | { type: 'dirty'; snapshot: DraftPersistenceSnapshot }
  | { type: 'saving'; snapshot: DraftPersistenceSnapshot }
  | { type: 'success'; wrote: boolean; snapshot: DraftPersistenceSnapshot }
  | { type: 'error'; error: string; snapshot: DraftPersistenceSnapshot }

type CollectionListener = (collection: DraftCollection) => void
type PersistenceListener = (event: DraftPersistenceEvent) => void

let collection: DraftCollection | null = null
let persistenceAllowed = true
let currentRevision = 0
let acknowledgedRevision = 0
let timer: number | null = null
let savingRevision: number | null = null
let lastError: string | null = null
let lastErrorAt: number | null = null
let lastSavedAt: number | null = null
const collectionListeners = new Set<CollectionListener>()
const persistenceListeners = new Set<PersistenceListener>()

const emitPersistence = (event: DraftPersistenceEvent) => {
  persistenceListeners.forEach((listener) => listener(event))
}

export const getDraftPersistenceSnapshot = (): DraftPersistenceSnapshot => {
  const status: DraftPersistenceStatus = savingRevision !== null
    ? 'saving'
    : lastError
      ? 'error'
      : acknowledgedRevision < currentRevision
        ? 'dirty'
        : 'saved'

  return {
    currentRevision,
    acknowledgedRevision,
    status,
    lastError,
    lastErrorAt,
    lastSavedAt,
  }
}

const ensureInitialized = (): DraftCollection => {
  if (collection) return collection

  const loaded = readWithMigrations('drafts')
  collection = normalizeDraftCollectionLifecycle(loaded.data)
  persistenceAllowed = loaded.status === 'ok' || loaded.status === 'missing'
  currentRevision += 1
  acknowledgedRevision = loaded.status === 'ok' ? currentRevision : currentRevision - 1
  lastError = null
  lastErrorAt = null
  return collection
}

const cancelScheduledPersistence = () => {
  if (timer !== null && isClient()) {
    window.clearTimeout(timer)
  }
  timer = null
}

export const initializeDraftPersistence = (
  initialCollection: DraftCollection,
  options: { allowPersistence: boolean; alreadyPersisted?: boolean }
) => {
  cancelScheduledPersistence()
  collection = normalizeDraftCollectionLifecycle(initialCollection)
  persistenceAllowed = options.allowPersistence
  currentRevision += 1
  acknowledgedRevision = options.allowPersistence && !options.alreadyPersisted
    ? currentRevision - 1
    : currentRevision
  savingRevision = null
  lastError = null
  lastErrorAt = null
  lastSavedAt = null
}

export const getAuthoritativeDraftCollection = (): DraftCollection => ensureInitialized()

export const isDraftPersistenceAllowed = (): boolean => {
  ensureInitialized()
  return persistenceAllowed
}

export const getDraftPersistenceRevision = () => ({
  current: currentRevision,
  acknowledged: acknowledgedRevision,
})

export const flushDraftPersistence = (): DraftPersistenceResult => {
  cancelScheduledPersistence()
  const current = ensureInitialized()

  if (!persistenceAllowed) {
    const result = {
      ok: false as const,
      revision: currentRevision,
      error: 'Draft persistence is disabled because stored drafts could not be loaded safely',
    }
    lastError = result.error
    lastErrorAt = Date.now()
    emitPersistence({ type: 'error', error: result.error, snapshot: getDraftPersistenceSnapshot() })
    return result
  }

  const revisionToWrite = currentRevision
  if (acknowledgedRevision >= revisionToWrite) {
    const result = { ok: true as const, revision: revisionToWrite, wrote: false }
    emitPersistence({ type: 'success', wrote: false, snapshot: getDraftPersistenceSnapshot() })
    return result
  }

  savingRevision = revisionToWrite
  lastError = null
  lastErrorAt = null
  emitPersistence({ type: 'saving', snapshot: getDraftPersistenceSnapshot() })
  const writeResult = tryWriteVersioned('drafts', current)
  if (!writeResult.ok) {
    savingRevision = null
    lastError = writeResult.error
    lastErrorAt = Date.now()
    const result = { ok: false as const, revision: revisionToWrite, error: writeResult.error }
    emitPersistence({ type: 'error', error: result.error, snapshot: getDraftPersistenceSnapshot() })
    return result
  }

  // Storage writes are synchronous. Acknowledgement advances only after the write succeeds.
  if (currentRevision === revisionToWrite) {
    acknowledgedRevision = revisionToWrite
    lastSavedAt = Date.now()
  }
  savingRevision = null
  lastError = null
  lastErrorAt = null
  const result = { ok: true as const, revision: revisionToWrite, wrote: true }
  emitPersistence({ type: 'success', wrote: true, snapshot: getDraftPersistenceSnapshot() })
  return result
}

export const scheduleDraftPersistence = (delayMs = 250) => {
  if (!isClient() || !persistenceAllowed) return
  cancelScheduledPersistence()
  timer = window.setTimeout(() => {
    timer = null
    // The callback intentionally reads the authoritative collection at flush time.
    flushDraftPersistence()
  }, delayMs)
}

export const replaceAuthoritativeDraftCollection = (
  nextCollection: DraftCollection,
  options: { persist: 'debounced' | 'immediate'; notify?: boolean } = { persist: 'debounced' }
): DraftPersistenceResult | null => {
  ensureInitialized()
  if (!persistenceAllowed) return null

  const normalizedCollection = normalizeDraftCollectionLifecycle(nextCollection)
  collection = normalizedCollection
  currentRevision += 1
  savingRevision = null
  lastError = null
  lastErrorAt = null
  if (options.notify !== false) {
    collectionListeners.forEach((listener) => listener(normalizedCollection))
  }

  emitPersistence({ type: 'dirty', snapshot: getDraftPersistenceSnapshot() })

  if (options.persist === 'immediate') return flushDraftPersistence()
  scheduleDraftPersistence()
  return null
}

export const mutateAuthoritativeDraftCollection = (
  mutate: (current: DraftCollection) => DraftCollection
): DraftPersistenceResult | null => {
  const current = ensureInitialized()
  if (!persistenceAllowed) return null
  return replaceAuthoritativeDraftCollection(mutate(current), { persist: 'immediate' })
}

export const subscribeDraftCollection = (listener: CollectionListener) => {
  collectionListeners.add(listener)
  return () => {
    collectionListeners.delete(listener)
  }
}

export const subscribeDraftPersistence = (listener: PersistenceListener) => {
  persistenceListeners.add(listener)
  return () => {
    persistenceListeners.delete(listener)
  }
}

export const resetDraftPersistenceForTests = () => {
  cancelScheduledPersistence()
  collection = null
  persistenceAllowed = true
  currentRevision = 0
  acknowledgedRevision = 0
  savingRevision = null
  lastError = null
  lastErrorAt = null
  lastSavedAt = null
}
