'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useAutosaveStore, type AutosaveStatus } from '@/store/autosaveStore'

const DEFAULT_DEBOUNCE_MS = 600
const TIMEOUT_MS = 10_000
const IDLE_RESET_MS = 1200

export type AutosavePayload = Record<string, unknown>

type UseAutosaveArgs = {
  getPayload: () => AutosavePayload
  debounceMs?: number
  onSaved?: () => void
}

type SaveOutcome = 'success' | 'error' | 'timeout' | 'aborted'

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

export function useAutosave({ getPayload, debounceMs = DEFAULT_DEBOUNCE_MS, onSaved }: UseAutosaveArgs) {
  const setStatus = useAutosaveStore((state) => state.setStatus)
  const setLastSavedAt = useAutosaveStore((state) => state.setLastSavedAt)
  const setErrorMessage = useAutosaveStore((state) => state.setErrorMessage)
  const setRunSave = useAutosaveStore((state) => state.setRunSave)

  const dirtyRef = useRef(false)
  const saveSeqRef = useRef(0)
  const debounceTimerRef = useRef<number | null>(null)
  const idleTimerRef = useRef<number | null>(null)
  const inflightRef = useRef<AbortController | null>(null)

  const clearDebounce = () => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }

  const finalize = useCallback(
    (seq: number, outcome: SaveOutcome, message?: string) => {
      if (seq !== saveSeqRef.current) return
      if (outcome === 'success') {
        dirtyRef.current = false
        setErrorMessage(null)
        setLastSavedAt(Date.now())
        setStatus('saved')
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[autosave] saved', { seq })
        }
        clearIdleTimer()
        idleTimerRef.current = window.setTimeout(() => {
          if (!dirtyRef.current && saveSeqRef.current === seq) {
            setStatus('idle')
          }
        }, IDLE_RESET_MS)
        onSaved?.()
        return
      }

      if (outcome === 'aborted') {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[autosave] aborted', { seq })
        }
        return
      }

      setStatus('error')
      setErrorMessage(message ?? (outcome === 'timeout' ? 'Save timed out' : 'Save failed'))
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[autosave] error', { seq, outcome, message })
      }
    },
    [onSaved, setErrorMessage, setLastSavedAt, setStatus]
  )

  const runSave = useCallback(async () => {
    if (!dirtyRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('offline')
      return
    }

    if (inflightRef.current) {
      inflightRef.current.abort('superseded')
    }

    const controller = new AbortController()
    inflightRef.current = controller
    const seq = ++saveSeqRef.current

    clearIdleTimer()
    setStatus('saving')
    setErrorMessage(null)

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[autosave] start', { seq })
    }

    const timeoutId = window.setTimeout(() => {
      controller.abort('timeout')
    }, TIMEOUT_MS)

    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getPayload()),
        signal: controller.signal,
      })

      window.clearTimeout(timeoutId)

      if (!response.ok) {
        finalize(seq, 'error', `Save failed (${response.status})`)
        return
      }

      finalize(seq, 'success')
    } catch (error) {
      window.clearTimeout(timeoutId)

      if (isAbort(error)) {
        const reason = controller.signal.reason
        if (reason === 'timeout') {
          finalize(seq, 'timeout')
        } else {
          finalize(seq, 'aborted')
        }
        return
      }

      finalize(seq, 'error', error instanceof Error ? error.message : 'Save failed')
    }
  }, [finalize, getPayload, setErrorMessage, setStatus])

  const markDirty = useCallback(() => {
    dirtyRef.current = true
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('offline')
    } else {
      setStatus('dirty')
    }

    clearDebounce()
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null
      runSave()
    }, debounceMs)
  }, [debounceMs, runSave, setStatus])

  useEffect(() => {
    setRunSave(() => runSave)
    return () => {
      setRunSave(null)
    }
  }, [runSave, setRunSave])

  useEffect(() => {
    const handleOnline = () => {
      if (!dirtyRef.current) return
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[autosave] online detected, scheduling save')
      }
      setStatus('dirty')
      clearDebounce()
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null
        runSave()
      }, 250)
    }

    const handleOffline = () => {
      if (dirtyRef.current) {
        setStatus('offline')
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearDebounce()
      clearIdleTimer()
      if (inflightRef.current) {
        inflightRef.current.abort('unmount')
      }
    }
  }, [runSave, setStatus])

  return { markDirty, runSave }
}
