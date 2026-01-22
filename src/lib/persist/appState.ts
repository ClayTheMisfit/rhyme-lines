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
import { applySettingsDefaults, SETTINGS_DEFAULTS } from './settingsDefaults'

export interface PersistedAppState {
  settings: SettingsSchema
  drafts: DraftCollection
  panel: PanelSchema
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

const getDefaultAppState = (): PersistedAppState => ({
  settings: applySettingsDefaults(SETTINGS_DEFAULTS),
  drafts: createDefaultDraftCollection(),
  panel: clonePanelState(DEFAULT_PANEL_STATE),
})

export function loadPersistedAppState(): PersistedAppState {
  if (!isClient()) {
    if (process.env.NODE_ENV === 'development') {
      assertClientOnly('persist:load-state')
    }
    return getDefaultAppState()
  }

  try {
    const settingsResult = readWithMigrations('settings')
    const draftsResult = readWithMigrations('drafts')
    const panelResult = readWithMigrations('panel')

    return {
      settings: applySettingsDefaults(settingsResult.data),
      drafts: draftsResult.data ?? createDefaultDraftCollection(),
      panel: clonePanelState(panelResult.data ?? DEFAULT_PANEL_STATE),
    }
  } catch {
    return getDefaultAppState()
  }
}
