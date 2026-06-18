'use client'

import { createWithEqualityFn } from 'zustand/traditional'
import { assertClientOnly } from '@/lib/env/assertClientOnly'
import { isClient } from '@/lib/env/isClient'
import {
  DEFAULT_SETTINGS,
  type BadgeSize,
  type DebounceMode,
  type RhymeFilters,
  type RhymeHighlightMode,
  type SettingsSchema,
  type ThemeSetting,
} from '@/lib/persist/schema'
import { writeVersioned } from '@/lib/persist/storage'
import { applySettingsDefaults, SETTINGS_DEFAULTS } from '@/lib/persist/settingsDefaults'

type SettingsDataPatch = Partial<Omit<SettingsSchema, 'lastUpdatedAt'>>

export type SettingsState = {
  theme: ThemeSetting
  fontSize: number
  lineHeight: number
  badgeSize: BadgeSize
  showLineTotals: boolean
  showRhymeDecorations: boolean
  showInternalRhymes: boolean
  highlightStopwords: boolean
  rhymeAutoRefresh: boolean
  rhymeHighlightMode: RhymeHighlightMode
  hideRhymeColors: boolean
  rhymeDebugOverlay: boolean
  debounceMode: DebounceMode
  highContrast: boolean
  rhymeFilters: RhymeFilters
  showVariants: boolean
  commonWordsOnly: boolean
  lastUpdatedAt: number
  setTheme: (theme?: ThemeSetting) => void
  setFontSize: (fontSize: number) => void
  setLineHeight: (lineHeight: number) => void
  setBadgeSize: (size: BadgeSize) => void
  setShowLineTotals: (value: boolean) => void
  setShowRhymeDecorations: (value: boolean) => void
  setShowInternalRhymes: (value: boolean) => void
  setHighlightStopwords: (value: boolean) => void
  setRhymeAutoRefresh: (value: boolean) => void
  setRhymeHighlightMode: (mode: RhymeHighlightMode) => void
  setHideRhymeColors: (value: boolean) => void
  setRhymeDebugOverlay: (value: boolean) => void
  setDebounceMode: (mode: DebounceMode) => void
  setHighContrast: (value: boolean) => void
  setRhymeFilters: (filters: RhymeFilters) => void
  setShowVariants: (value: boolean) => void
  setCommonWordsOnly: (value: boolean) => void
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
    showRhymeDecorations: state.showRhymeDecorations,
    showInternalRhymes: state.showInternalRhymes,
    highlightStopwords: state.highlightStopwords,
    rhymeAutoRefresh: state.rhymeAutoRefresh,
    rhymeHighlightMode: state.rhymeHighlightMode,
    hideRhymeColors: state.hideRhymeColors,
    rhymeDebugOverlay: state.rhymeDebugOverlay,
    debounceMode: state.debounceMode,
    highContrast: state.highContrast,
    rhymeFilters: state.rhymeFilters,
    showVariants: state.showVariants,
    commonWordsOnly: state.commonWordsOnly,
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

export const useSettingsStore = createWithEqualityFn<SettingsState>()((set, get) => {

  const setAndPersist = (partial: SettingsDataPatch) => {
    set({ ...partial, lastUpdatedAt: Date.now() })
    schedulePersist(get())
  }

  return {
    ...baseSettings,
    setTheme: () => {
      set({ theme: 'dark', lastUpdatedAt: Date.now() })
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
  setShowRhymeDecorations: (showRhymeDecorations) => {
    set({ showRhymeDecorations, lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  setShowInternalRhymes: (showInternalRhymes) => {
    set({ showInternalRhymes, lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  setHighlightStopwords: (highlightStopwords) => {
    set({ highlightStopwords, lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  setRhymeAutoRefresh: (rhymeAutoRefresh) => {
    set({ rhymeAutoRefresh, lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  setRhymeHighlightMode: (rhymeHighlightMode) => {
    setAndPersist({ rhymeHighlightMode })
  },
  setHideRhymeColors: (hideRhymeColors) => {
    setAndPersist({ hideRhymeColors })
  },
  setRhymeDebugOverlay: (rhymeDebugOverlay) => {
    setAndPersist({ rhymeDebugOverlay })
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
  setShowVariants: (showVariants) => {
    void showVariants
    set({ showVariants: false, lastUpdatedAt: Date.now() })
    schedulePersist(get())
  },
  setCommonWordsOnly: (commonWordsOnly) => {
    set({ commonWordsOnly, lastUpdatedAt: Date.now() })
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
}
}, Object.is)

export type SettingsSnapshot = Pick<
  SettingsState,
  | 'theme'
  | 'fontSize'
  | 'lineHeight'
  | 'badgeSize'
  | 'showLineTotals'
  | 'showRhymeDecorations'
  | 'showInternalRhymes'
  | 'highlightStopwords'
  | 'rhymeAutoRefresh'
  | 'rhymeHighlightMode'
  | 'hideRhymeColors'
  | 'rhymeDebugOverlay'
  | 'debounceMode'
  | 'highContrast'
  | 'rhymeFilters'
  | 'showVariants'
  | 'commonWordsOnly'
>

/**
 * Get a snapshot of the current settings.
 *
 * @returns A SettingsSnapshot containing the current values for `theme`, `fontSize`, `lineHeight`, `badgeSize`, `showLineTotals`, `showRhymeDecorations`, `showInternalRhymes`, `highlightStopwords`, `rhymeAutoRefresh`, `rhymeHighlightMode`, `hideRhymeColors`, `rhymeDebugOverlay`, `debounceMode`, `highContrast`, `rhymeFilters`, `showVariants`, and `commonWordsOnly`.
 */
export function getCurrentSettingsSnapshot(): SettingsSnapshot {
  const {
    theme,
    fontSize,
    lineHeight,
    badgeSize,
    showLineTotals,
    showRhymeDecorations,
    showInternalRhymes,
    highlightStopwords,
    rhymeAutoRefresh,
    rhymeHighlightMode,
    hideRhymeColors,
    rhymeDebugOverlay,
    debounceMode,
    highContrast,
    rhymeFilters,
    showVariants,
    commonWordsOnly,
  } = useSettingsStore.getState()
  return {
    theme,
    fontSize,
    lineHeight,
    badgeSize,
    showLineTotals,
    showRhymeDecorations,
    showInternalRhymes,
    highlightStopwords,
    rhymeAutoRefresh,
    rhymeHighlightMode,
    hideRhymeColors,
    rhymeDebugOverlay,
    debounceMode,
    highContrast,
    rhymeFilters,
    showVariants,
    commonWordsOnly,
  }
}

/**
 * Apply the given settings snapshot to the current settings store, updating each corresponding setting.
 *
 * @param snapshot - Settings values to apply; each field replaces the current store value for that setting
 */
export function applySettingsSnapshot(snapshot: SettingsSnapshot) {
  const {
    setTheme,
    setFontSize,
    setLineHeight,
    setBadgeSize,
    setShowLineTotals,
    setShowRhymeDecorations,
    setShowInternalRhymes,
    setHighlightStopwords,
    setRhymeAutoRefresh,
    setRhymeHighlightMode,
    setHideRhymeColors,
    setRhymeDebugOverlay,
    setDebounceMode,
    setHighContrast,
    setRhymeFilters,
    setShowVariants,
    setCommonWordsOnly,
  } = useSettingsStore.getState()

  setTheme('dark')
  setFontSize(snapshot.fontSize)
  setLineHeight(snapshot.lineHeight)
  setBadgeSize(snapshot.badgeSize)
  setShowLineTotals(snapshot.showLineTotals)
  setShowRhymeDecorations(snapshot.showRhymeDecorations)
  setShowInternalRhymes(snapshot.showInternalRhymes)
  setHighlightStopwords(snapshot.highlightStopwords)
  setRhymeAutoRefresh(snapshot.rhymeAutoRefresh)
  setRhymeHighlightMode(snapshot.rhymeHighlightMode)
  setHideRhymeColors(snapshot.hideRhymeColors)
  setRhymeDebugOverlay(snapshot.rhymeDebugOverlay)
  setDebounceMode(snapshot.debounceMode)
  setHighContrast(snapshot.highContrast)
  setRhymeFilters(snapshot.rhymeFilters)
  setShowVariants(snapshot.showVariants)
  setCommonWordsOnly(snapshot.commonWordsOnly)
}

export function hydrateSettingsStore(payload: SettingsSchema) {
  const normalized = applySettingsDefaults(payload)
  useSettingsStore.setState((state) => ({
    ...state,
    ...(normalized as SettingsState),
  }))
}

export { SETTINGS_DEFAULTS }
