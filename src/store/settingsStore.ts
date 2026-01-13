'use client'

import { createWithEqualityFn } from 'zustand/traditional'
import { assertClientOnly } from '@/lib/env/assertClientOnly'
import { isClient } from '@/lib/env/isClient'
import {
  DEFAULT_SETTINGS,
  type BadgeSize,
  type DebounceMode,
  type RhymeFilters,
  type SettingsSchema,
  type ThemeSetting,
} from '@/lib/persist/schema'
import { writeVersioned } from '@/lib/persist/storage'
import { applySettingsDefaults, SETTINGS_DEFAULTS } from '@/lib/persist/settingsDefaults'

export type SettingsState = {
  theme: ThemeSetting
  fontSize: number
  lineHeight: number
  badgeSize: BadgeSize
  showLineTotals: boolean
  rhymeAutoRefresh: boolean
  debounceMode: DebounceMode
  highContrast: boolean
  rhymeFilters: RhymeFilters
  lastUpdatedAt: number
  setTheme: (theme: ThemeSetting) => void
  setFontSize: (fontSize: number) => void
  setLineHeight: (lineHeight: number) => void
  setBadgeSize: (size: BadgeSize) => void
  setShowLineTotals: (value: boolean) => void
  setRhymeAutoRefresh: (value: boolean) => void
  setDebounceMode: (mode: DebounceMode) => void
  setHighContrast: (value: boolean) => void
  setRhymeFilters: (filters: RhymeFilters) => void
  resetDefaults: () => void
}

const PERSIST_DEBOUNCE_MS = 250

const clampValue = (value: number, fallback: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

const persistSettings = (state: SettingsState) => {
  const payload: SettingsSchema = {
    theme: state.theme,
    fontSize: state.fontSize,
    lineHeight: state.lineHeight,
    badgeSize: state.badgeSize,
    showLineTotals: state.showLineTotals,
    rhymeAutoRefresh: state.rhymeAutoRefresh,
    debounceMode: state.debounceMode,
    highContrast: state.highContrast,
    rhymeFilters: state.rhymeFilters,
    lastUpdatedAt: Date.now(),
  }
  writeVersioned('settings', payload)
}

let persistTimer: number | null = null
const schedulePersist = (state: SettingsState) => {
  if (!isClient()) {
    if (process.env.NODE_ENV === 'development') {
      assertClientOnly('settings:persist')
    }
    return
  }
  if (persistTimer) {
    window.clearTimeout(persistTimer)
  }
  persistTimer = window.setTimeout(() => {
    persistSettings(state)
    persistTimer = null
  }, PERSIST_DEBOUNCE_MS)
}

const baseSettings: SettingsState = applySettingsDefaults({
  ...DEFAULT_SETTINGS,
  rhymeFilters: { ...DEFAULT_SETTINGS.rhymeFilters },
  lastUpdatedAt: Date.now(),
}) as SettingsState

export const useSettingsStore = createWithEqualityFn<SettingsState>()((set, get) => ({
  ...baseSettings,
  setTheme: (theme) => {
    set({ theme, lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  setFontSize: (fontSize) => {
    set({ fontSize: clampValue(fontSize, DEFAULT_SETTINGS.fontSize, 12, 48), lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  setLineHeight: (lineHeight) => {
    set({ lineHeight: clampValue(lineHeight, DEFAULT_SETTINGS.lineHeight, 1, 2.4), lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  setBadgeSize: (badgeSize) => {
    set({ badgeSize, lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  setShowLineTotals: (showLineTotals) => {
    set({ showLineTotals, lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  setRhymeAutoRefresh: (rhymeAutoRefresh) => {
    set({ rhymeAutoRefresh, lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  setDebounceMode: (debounceMode) => {
    set({ debounceMode, lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  setHighContrast: (highContrast) => {
    set({ highContrast, lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  setRhymeFilters: (rhymeFilters) => {
    set({ rhymeFilters, lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  resetDefaults: () => {
    const resetState = applySettingsDefaults({
      ...DEFAULT_SETTINGS,
      rhymeFilters: { ...DEFAULT_SETTINGS.rhymeFilters },
      lastUpdatedAt: Date.now(),
    })
    set(resetState)
    schedulePersist(get())
  },
}), Object.is)

export type SettingsSnapshot = Pick<
  SettingsState,
  | 'theme'
  | 'fontSize'
  | 'lineHeight'
  | 'badgeSize'
  | 'showLineTotals'
  | 'rhymeAutoRefresh'
  | 'debounceMode'
  | 'highContrast'
  | 'rhymeFilters'
>

export function getCurrentSettingsSnapshot(): SettingsSnapshot {
  const {
    theme,
    fontSize,
    lineHeight,
    badgeSize,
    showLineTotals,
    rhymeAutoRefresh,
    debounceMode,
    highContrast,
    rhymeFilters,
  } = useSettingsStore.getState()
  return {
    theme,
    fontSize,
    lineHeight,
    badgeSize,
    showLineTotals,
    rhymeAutoRefresh,
    debounceMode,
    highContrast,
    rhymeFilters,
  }
}

export function applySettingsSnapshot(snapshot: SettingsSnapshot) {
  const {
    setTheme,
    setFontSize,
    setLineHeight,
    setBadgeSize,
    setShowLineTotals,
    setRhymeAutoRefresh,
    setDebounceMode,
    setHighContrast,
    setRhymeFilters,
  } = useSettingsStore.getState()

  setTheme(snapshot.theme)
  setFontSize(snapshot.fontSize)
  setLineHeight(snapshot.lineHeight)
  setBadgeSize(snapshot.badgeSize)
  setShowLineTotals(snapshot.showLineTotals)
  setRhymeAutoRefresh(snapshot.rhymeAutoRefresh)
  setDebounceMode(snapshot.debounceMode)
  setHighContrast(snapshot.highContrast)
  setRhymeFilters(snapshot.rhymeFilters)
}

export function hydrateSettingsStore(payload: SettingsSchema) {
  const normalized = applySettingsDefaults(payload)
  useSettingsStore.setState((state) => ({
    ...state,
    ...(normalized as SettingsState),
  }))
}

export { SETTINGS_DEFAULTS }
