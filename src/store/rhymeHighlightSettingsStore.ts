'use client'

import { createWithEqualityFn } from 'zustand/traditional'
import { RHYME_HIGHLIGHT_DEFAULTS, loadRhymeHighlightSettings, saveRhymeHighlightSettings, type RhymeHighlightSettings } from '@/lib/settings/rhymeHighlightSettings'
import type { RhymeHighlightMode } from '@/lib/persist/schema'

export type RhymeHighlightSettingsState = RhymeHighlightSettings & {
  hydrated: boolean
  hydrate: () => void
  setShowInternalRhymes: (value: boolean) => void
  setHighlightStopwords: (value: boolean) => void
  setHighlightMode: (value: RhymeHighlightMode) => void
  setHideColorfulWords: (value: boolean) => void
}

export const useRhymeHighlightSettingsStore = createWithEqualityFn<RhymeHighlightSettingsState>()((set, get) => {
  const setAndPersist = (partial: Partial<RhymeHighlightSettings>) => {
    set(partial)
    const next = get()
    saveRhymeHighlightSettings({
      showInternalRhymes: next.showInternalRhymes,
      highlightStopwords: next.highlightStopwords,
      highlightMode: next.highlightMode,
      hideColorfulWords: next.hideColorfulWords,
    })
  }

  return {
    ...RHYME_HIGHLIGHT_DEFAULTS,
    hydrated: false,
    hydrate: () => {
      const loaded = loadRhymeHighlightSettings()
      set({ ...loaded, hydrated: true })
    },
    setShowInternalRhymes: (showInternalRhymes) => setAndPersist({ showInternalRhymes }),
    setHighlightStopwords: (highlightStopwords) => setAndPersist({ highlightStopwords }),
    setHighlightMode: (highlightMode) => setAndPersist({ highlightMode }),
    setHideColorfulWords: (hideColorfulWords) => setAndPersist({ hideColorfulWords }),
  }
}, Object.is)
