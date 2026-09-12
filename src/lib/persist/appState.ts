import { assertClientOnly } from '@/lib/env/assertClientOnly'
import { isClient } from '@/lib/env/isClient'
import {
  DEFAULT_PANEL_STATE,
  createDefaultDraftCollection,
  type DraftCollection,
  type PanelSchema,
  type SettingsSchema,
} from './schema'
import { readWithMigrations } from './storage'
import type { PersistenceLoadStatus, VersionedResult } from './migrations'
import { applySettingsDefaults, SETTINGS_DEFAULTS } from './settingsDefaults'

export interface PersistedAppState {
  settings: SettingsSchema
  drafts: DraftCollection
  panel: PanelSchema
  hydration: {
    settings: PersistenceLoadStatus
    drafts: PersistenceLoadStatus
    panel: PersistenceLoadStatus
  }
}

const clonePanelState = (panel: PanelSchema): PanelSchema => ({
  rhymePanel: {
    ...panel.rhymePanel,
    position: panel.rhymePanel.position ? { ...panel.rhymePanel.position } : undefined,
  },
  filters: { ...panel.filters },
  lastTargetWord: panel.lastTargetWord,
  searchQuery: panel.searchQuery,
  selectedIndex: panel.selectedIndex,
  syllableFilter: panel.syllableFilter,
  multiSyllablePerfect: panel.multiSyllablePerfect,
})

const getDefaultAppState = (status: PersistenceLoadStatus = 'missing'): PersistedAppState => ({
  settings: applySettingsDefaults(SETTINGS_DEFAULTS),
  drafts: createDefaultDraftCollection(),
  panel: clonePanelState(DEFAULT_PANEL_STATE),
  hydration: { settings: status, drafts: status, panel: status },
})

const readSlice = <T>(read: () => VersionedResult<T>, fallback: T): VersionedResult<T> => {
  try {
    return read()
  } catch {
    return {
      version: 0,
      data: fallback,
      status: 'unavailable',
    }
  }
}

export function loadPersistedAppState(): PersistedAppState {
  if (!isClient()) {
    if (process.env.NODE_ENV === 'development') {
      assertClientOnly('persist:load-state')
    }
    return getDefaultAppState('unavailable')
  }

  const defaults = getDefaultAppState()
  const settingsResult = readSlice(() => readWithMigrations('settings'), defaults.settings)
  const draftsResult = readSlice(() => readWithMigrations('drafts'), defaults.drafts)
  const panelResult = readSlice(() => readWithMigrations('panel'), defaults.panel)

  return {
    settings: applySettingsDefaults(settingsResult.data),
    drafts: draftsResult.data,
    panel: clonePanelState(panelResult.data),
    hydration: {
      settings: settingsResult.status,
      drafts: draftsResult.status,
      panel: panelResult.status,
    },
  }
}
