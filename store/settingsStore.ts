'use client'

import { createWithEqualityFn } from 'zustand/traditional'
import { persist, createJSONStorage } from 'zustand/middleware'

type Theme = 'light' | 'dark'
type BadgeSize = 'xs' | 'sm' | 'md'
type DebounceMode = 'cursor-50' | 'typing-250'

export type SettingsState = {
  theme: Theme
  fontSize: number
  lineHeight: number
  badgeSize: BadgeSize
  showLineTotals: boolean
  rhymeAutoRefresh: boolean
  debounceMode: DebounceMode
  setTheme: (theme: Theme) => void
  setFontSize: (fontSize: number) => void
  setLineHeight: (lineHeight: number) => void
  setBadgeSize: (size: BadgeSize) => void
  setShowLineTotals: (value: boolean) => void
  setRhymeAutoRefresh: (value: boolean) => void
  setDebounceMode: (mode: DebounceMode) => void
  resetDefaults: () => void
}

export const SETTINGS_DEFAULTS: Pick<SettingsState,
  'theme' | 'fontSize' | 'lineHeight' | 'badgeSize' | 'showLineTotals' | 'rhymeAutoRefresh' | 'debounceMode'
> = {
  theme: 'dark',
  fontSize: 18,
  lineHeight: 1.6,
  badgeSize: 'sm',
  showLineTotals: true,
  rhymeAutoRefresh: true,
  debounceMode: 'typing-250',
}

type PersistedSettings = Pick<SettingsState,
  'theme' | 'fontSize' | 'lineHeight' | 'badgeSize' | 'showLineTotals' | 'rhymeAutoRefresh' | 'debounceMode'
>

const storage = typeof window === 'undefined'
  ? undefined
  : createJSONStorage<PersistedSettings>(() => window.localStorage)

export const useSettingsStore = createWithEqualityFn<SettingsState>()(
  persist(
    (set) => ({
      ...SETTINGS_DEFAULTS,
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setBadgeSize: (badgeSize) => set({ badgeSize }),
      setShowLineTotals: (showLineTotals) => set({ showLineTotals }),
      setRhymeAutoRefresh: (rhymeAutoRefresh) => set({ rhymeAutoRefresh }),
      setDebounceMode: (debounceMode) => set({ debounceMode }),
      resetDefaults: () => set({ ...SETTINGS_DEFAULTS }),
    }),
    {
      name: 'rhyme-lines:settings',
      storage,
      version: 1,
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        badgeSize: state.badgeSize,
        showLineTotals: state.showLineTotals,
        rhymeAutoRefresh: state.rhymeAutoRefresh,
        debounceMode: state.debounceMode,
      }),
    }
  ),
  Object.is
)

export type SettingsSnapshot = Pick<SettingsState,
  'theme' | 'fontSize' | 'lineHeight' | 'badgeSize' | 'showLineTotals' | 'rhymeAutoRefresh' | 'debounceMode'
>

export function getCurrentSettingsSnapshot(): SettingsSnapshot {
  const { theme, fontSize, lineHeight, badgeSize, showLineTotals, rhymeAutoRefresh, debounceMode } = useSettingsStore.getState()
  return {
    theme,
    fontSize,
    lineHeight,
    badgeSize,
    showLineTotals,
    rhymeAutoRefresh,
    debounceMode,
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
  } = useSettingsStore.getState()

  setTheme(snapshot.theme)
  setFontSize(snapshot.fontSize)
  setLineHeight(snapshot.lineHeight)
  setBadgeSize(snapshot.badgeSize)
  setShowLineTotals(snapshot.showLineTotals)
  setRhymeAutoRefresh(snapshot.rhymeAutoRefresh)
  setDebounceMode(snapshot.debounceMode)
}

