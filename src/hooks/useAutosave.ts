'use client'

import { useCallback, useEffect } from 'react'
import { trackEvent } from '@/lib/analytics/events'
import {
  flushDraftPersistence,
  getDraftPersistenceSnapshot,
  scheduleDraftPersistence,
  subscribeDraftPersistence,
} from '@/lib/persist/draftCoordinator'
import { useAutosaveStore } from '@/store/autosaveStore'

const DEFAULT_DEBOUNCE_MS = 600

type UseAutosaveArgs = {
  debounceMs?: number
  onSaved?: () => void
}

export function useAutosave({ debounceMs = DEFAULT_DEBOUNCE_MS, onSaved }: UseAutosaveArgs = {}) {
  const setRunSave = useAutosaveStore((state) => state.setRunSave)
  const syncFromPersistence = useAutosaveStore((state) => state.syncFromPersistence)

  const runSave = useCallback(() => {
    flushDraftPersistence()
  }, [])

  const markTextChanged = useCallback(() => {
    scheduleDraftPersistence(debounceMs)
  }, [debounceMs])

  useEffect(() => {
    syncFromPersistence(getDraftPersistenceSnapshot())
    return subscribeDraftPersistence((event) => {
      syncFromPersistence(event.snapshot)
      if (event.type === 'error') {
        trackEvent('autosave_failed', { reason: event.error })
        return
      }
      if (
        event.type === 'success'
        && event.snapshot.currentRevision === event.snapshot.acknowledgedRevision
      ) {
        if (event.wrote) trackEvent('autosave_succeeded')
        onSaved?.()
      }
    })
  }, [onSaved, syncFromPersistence])

  useEffect(() => {
    setRunSave(runSave)
    return () => {
      flushDraftPersistence()
      setRunSave(null)
    }
  }, [runSave, setRunSave])

  useEffect(() => {
    const flushForPageLifecycle = () => {
      const snapshot = getDraftPersistenceSnapshot()
      if (snapshot.currentRevision > snapshot.acknowledgedRevision) {
        flushDraftPersistence()
      }
    }

    window.addEventListener('pagehide', flushForPageLifecycle)
    window.addEventListener('beforeunload', flushForPageLifecycle)
    return () => {
      window.removeEventListener('pagehide', flushForPageLifecycle)
      window.removeEventListener('beforeunload', flushForPageLifecycle)
    }
  }, [])

  return { markTextChanged, runSave }
}
