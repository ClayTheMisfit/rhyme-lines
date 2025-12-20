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
  drafts: ['rhyme-lines.tabs.v1', 'rhyme-lines:doc:current:v2', 'rhyme-lines:doc:current'],
  panel: ['rhyme-panel-store', 'rhyme-lines:ui:rhyme-panel'],
}

const migrationMap = {
  settings: migrateSettings,
  drafts: migrateDrafts,
  panel: migratePanel,
}

const isClientStorageAvailable = (): boolean => {
  if (!isClient()) {
    if (process.env.NODE_ENV === 'development') {
      assertClientOnly('persist:storage')
    }
    return false
  }
  assertClientOnly('persist:storage-access')
  if (!window.localStorage) return false
  try {
    const probeKey = '__rl_storage_probe__'
    window.localStorage.setItem(probeKey, probeKey)
    window.localStorage.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}

const collectCandidates = (key: StorageKey): StoredValueCandidate[] => {
  if (!isClientStorageAvailable()) return []
  const keys = [STORAGE_KEYS[key], ...LEGACY_KEYS[key]]
  const candidates: StoredValueCandidate[] = []
  for (const storageKey of keys) {
    const value = window.localStorage.getItem(storageKey)
    if (value !== null) {
      candidates.push({ key: storageKey, value })
    }
  }
  return candidates
}

export function readWithMigrations<K extends StorageKey>(key: K): VersionedResult<StorageDataMap[K]> {
  const candidates = collectCandidates(key)
  const migrate = migrationMap[key]
  return migrate(candidates) as VersionedResult<StorageDataMap[K]>
}

export function writeVersioned<K extends StorageKey>(
  key: K,
  data: StorageDataMap[K],
  version = CURRENT_SCHEMA_VERSION
): void {
  if (!isClientStorageAvailable()) return
  try {
    const payload = JSON.stringify({ version, data })
    window.localStorage.setItem(STORAGE_KEYS[key], payload)
  } catch {
    // No-op: storage failures should not crash the app
  }
}

export function clearPersistedState(): void {
  if (!isClientStorageAvailable()) return
  const allKeys = new Set<string>()
  ;(Object.keys(STORAGE_KEYS) as StorageKey[]).forEach((key) => {
    allKeys.add(STORAGE_KEYS[key])
    LEGACY_KEYS[key].forEach((legacyKey) => allKeys.add(legacyKey))
  })
  for (const key of allKeys) {
    window.localStorage.removeItem(key)
  }
}

export function readStoredVersions(): Record<StorageKey, number | null> {
  if (!isClientStorageAvailable()) {
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

  ;(Object.keys(STORAGE_KEYS) as StorageKey[]).forEach((key) => {
    const raw = window.localStorage.getItem(STORAGE_KEYS[key])
    const parsed = safeParseJSON<{ version?: number } | null>(raw, null)
    result[key] = parsed?.version ?? null
  })

  return result
}

export function debugStorageSnapshot(): void {
  if (process.env.NEXT_PUBLIC_DEBUG_STORAGE !== '1') return
  if (!isClientStorageAvailable()) {
    // eslint-disable-next-line no-console
    console.debug('[persist] storage unavailable')
    return
  }
  const versions = readStoredVersions()
  // eslint-disable-next-line no-console
  console.debug('[persist] stored versions', versions)
  const drafts = readWithMigrations('drafts')
  // eslint-disable-next-line no-console
  console.debug('[persist] draft count', drafts.data.drafts.length)
}

export const getDefaultDrafts = createDefaultDraftCollection

export type { VersionedResult }
export { safeParseJSON } from './migrations'
