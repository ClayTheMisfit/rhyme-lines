'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useAutosaveStore } from '@/store/autosaveStore'
import { buildDraftCollection, getLastPersistedDraftCollection, useTabsStore } from '@/store/tabsStore'
import { tryWriteVersioned } from '@/lib/persist/storage'
import { trackEvent } from '@/lib/analytics/events'

const DEFAULT_DEBOUNCE_MS = 600

type UseAutosaveArgs = {
  debounceMs?: number
  onSaved?: () => void
}

export function useAutosave({ debounceMs = DEFAULT_DEBOUNCE_MS, onSaved }: UseAutosaveArgs = {}) {
  const setRunSave = useAutosaveStore((state) => state.setRunSave)
  const initialize = useAutosaveStore((state) => state.initialize)
  const markChanged = useAutosaveStore((state) => state.markChanged)
  const startSaving = useAutosaveStore((state) => state.startSaving)
  const completeSaving = useAutosaveStore((state) => state.completeSaving)
  const failSaving = useAutosaveStore((state) => state.failSaving)

  const debounceTimerRef = useRef<number | null>(null)

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [])

  const runSave = useCallback(async () => {
    const autosaveState = useAutosaveStore.getState()
    if (autosaveState.rev === autosaveState.savedRev) {
      return
    }

    const revAtStart = startSaving()
    try {
      const tabsState = useTabsStore.getState()
      const payload = buildDraftCollection(tabsState, getLastPersistedDraftCollection())
      const result = tryWriteVersioned('drafts', payload)

      if (!result.ok) {
        trackEvent('autosave_failed', { reason: result.error })
        failSaving(result.error)
        return
      }

      const savedLatest = completeSaving(revAtStart)
      if (savedLatest) {
        trackEvent('autosave_succeeded')
        onSaved?.()
      }
    } catch (error) {
      trackEvent('autosave_failed', { reason: error instanceof Error ? error.message : 'Save failed' })
      failSaving(error instanceof Error ? error.message : 'Save failed')
    }
  }, [completeSaving, failSaving, onSaved, startSaving])

  const scheduleSave = useCallback(() => {
    clearDebounce()
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null
      void runSave()
    }, debounceMs)
  }, [clearDebounce, debounceMs, runSave])

  const markTextChanged = useCallback(() => {
    markChanged()
    scheduleSave()
  }, [markChanged, scheduleSave])

  useEffect(() => {
    initialize(0)
  }, [initialize])

  useEffect(() => {
    setRunSave(() => {
      void runSave()
    })
    return () => {
      setRunSave(null)
    }
  }, [runSave, setRunSave])

  useEffect(() => {
    return () => {
      clearDebounce()
    }
  }, [clearDebounce])

  return { markTextChanged, runSave }
}
