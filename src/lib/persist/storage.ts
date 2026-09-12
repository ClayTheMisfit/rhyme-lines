import { assertClientOnly } from '@/lib/env/assertClientOnly'
import { isClient } from '@/lib/env/isClient'
import {
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEYS,
  type StorageKey,
  type DraftCollection,
  type PanelSchema,
  type SettingsSchema,
  createDefaultDraftCollection,
} from './schema'
import {
  migrateDrafts,
  migratePanel,
  migrateSettings,
  type StoredValueCandidate,
  type VersionedResult,
  safeParseJSON,
} from './migrations'

type StorageDataMap = {
  settings: SettingsSchema
  drafts: DraftCollection
  panel: PanelSchema
}

const LEGACY_KEYS: Record<StorageKey, string[]> = {
  settings: ['rhyme-lines:settings'],
  drafts: [
    'rhyme-lines.tabs.v1',
    'rhyme-lines:doc:current:v2',
    'rhyme-lines:doc:current',
  ],
  panel: ['rhyme-panel-store', 'rhyme-lines:ui:rhyme-panel'],
}

// Legacy keys used only for one-time migrations, never cleared by clearPersistedState
const MIGRATION_READ_ONLY_KEYS: Record<StorageKey, string[]> = {
  settings: [],
  drafts: ['draft', 'editor-content', 'autosave'],
  panel: [],
}

const migrationMap = {
  settings: migrateSettings,
  drafts: migrateDrafts,
  panel: migratePanel,
}

const getClientStorage = (): Storage | null => {
  if (!isClient()) {
    if (process.env.NODE_ENV === 'development') {
      assertClientOnly('persist:storage')
    }
    return null
  }
  assertClientOnly('persist:storage-access')
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

type CandidateCollection =
  | { status: 'ok' | 'missing'; storage: Storage; candidates: StoredValueCandidate[] }
  | { status: 'unavailable'; candidates: [] }

const collectCandidates = (key: StorageKey): CandidateCollection => {
  const storage = getClientStorage()
  if (!storage) return { status: 'unavailable', candidates: [] }
  const keys = [STORAGE_KEYS[key], ...LEGACY_KEYS[key], ...MIGRATION_READ_ONLY_KEYS[key]]
  const candidates: StoredValueCandidate[] = []
  try {
    for (const storageKey of keys) {
      const value = storage.getItem(storageKey)
      if (value !== null) {
        candidates.push({
          key: storageKey,
          value,
          allowRawText: key === 'drafts' && MIGRATION_READ_ONLY_KEYS.drafts.includes(storageKey),
        })
      }
    }
  } catch {
    return { status: 'unavailable', candidates: [] }
  }
  return { status: candidates.length ? 'ok' : 'missing', storage, candidates }
}

const pendingMigrationCleanup: Record<StorageKey, Set<string>> = {
  settings: new Set(),
  drafts: new Set(),
  panel: new Set(),
}

const cleanupMigratedSources = (key: StorageKey, storage: Storage): void => {
  for (const sourceKey of [...pendingMigrationCleanup[key]]) {
    try {
      storage.removeItem(sourceKey)
      pendingMigrationCleanup[key].delete(sourceKey)
    } catch {
      // Keep the source queued and intact until a later successful write can retry cleanup.
    }
  }
}

export function readWithMigrations<K extends StorageKey>(key: K): VersionedResult<StorageDataMap[K]> {
  const collected = collectCandidates(key)
  const migrate = migrationMap[key]
  if (collected.status === 'unavailable') {
    const fallback = migrate([]) as VersionedResult<StorageDataMap[K]>
    return { ...fallback, status: 'unavailable' }
  }

  const result = migrate(collected.candidates) as VersionedResult<StorageDataMap[K]>
  if (result.status !== 'ok') return result

  const legacySources = (result.sourceKeys ?? []).filter((sourceKey) => sourceKey !== STORAGE_KEYS[key])
  if (!legacySources.length) return result

  legacySources.forEach((sourceKey) => pendingMigrationCleanup[key].add(sourceKey))
  const writeResult = tryWriteVersioned(key, result.data)
  return { ...result, writable: writeResult.ok }
}

export function writeVersioned<K extends StorageKey>(
  key: K,
  data: StorageDataMap[K],
  version = CURRENT_SCHEMA_VERSION
): void {
  void tryWriteVersioned(key, data, version)
}

export function tryWriteVersioned<K extends StorageKey>(
  key: K,
  data: StorageDataMap[K],
  version = CURRENT_SCHEMA_VERSION
): { ok: true } | { ok: false; error: string } {
  const storage = getClientStorage()
  if (!storage) {
    return { ok: false, error: 'localStorage is unavailable' }
  }

  try {
    const payload = JSON.stringify({ version, data })
    storage.setItem(STORAGE_KEYS[key], payload)
    cleanupMigratedSources(key, storage)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Unable to write to localStorage' }
  }
}

export function clearPersistedState(): void {
  const storage = getClientStorage()
  if (!storage) return
  const allKeys = new Set<string>()
  ;(Object.keys(STORAGE_KEYS) as StorageKey[]).forEach((key) => {
    allKeys.add(STORAGE_KEYS[key])
    LEGACY_KEYS[key].forEach((legacyKey) => allKeys.add(legacyKey))
    MIGRATION_READ_ONLY_KEYS[key].forEach((migrationKey) => allKeys.add(migrationKey))
  })
  for (const key of allKeys) {
    try {
      storage.removeItem(key)
    } catch {
      return
    }
  }
}

export function readStoredVersions(): Record<StorageKey, number | null> {
  const storage = getClientStorage()
  if (!storage) {
    return {
      settings: null,
      drafts: null,
      panel: null,
    }
  }

  const result: Record<StorageKey, number | null> = {
    settings: null,
    drafts: null,
    panel: null,
  }

  try {
    ;(Object.keys(STORAGE_KEYS) as StorageKey[]).forEach((key) => {
      const raw = storage.getItem(STORAGE_KEYS[key])
      const parsed = safeParseJSON<{ version?: number } | null>(raw, null)
      result[key] = parsed?.version ?? null
    })
  } catch {
    return result
  }

  return result
}

export function debugStorageSnapshot(): void {
  if (process.env.NEXT_PUBLIC_DEBUG_STORAGE !== '1') return
  if (!getClientStorage()) {
    // eslint-disable-next-line no-console
    console.debug('[persist] storage unavailable')
    return
  }
  const versions = readStoredVersions()
  // eslint-disable-next-line no-console
  console.debug('[persist] stored versions', versions)
  const drafts = readWithMigrations('drafts')
  // eslint-disable-next-line no-console
  console.debug('[persist] draft load', drafts.status, drafts.data.drafts.length)
}

export const getDefaultDrafts = createDefaultDraftCollection

export type { VersionedResult }
export { safeParseJSON } from './migrations'
