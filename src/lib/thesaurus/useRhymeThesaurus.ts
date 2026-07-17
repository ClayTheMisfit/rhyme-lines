'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeToken } from '@/lib/rhyme-db/normalizeToken'
import { fetchDatamuseThesaurus } from '@/lib/thesaurus/providers/datamuseThesaurus'
import type { ThesaurusPhase, ThesaurusResult, ThesaurusStatus } from '@/lib/thesaurus/types'

const CACHE_TTL_MS = 12 * 60 * 1000
const CACHE_LIMIT = 100
const TARGET_DEBOUNCE_MS = 250

type CacheEntry = { result: ThesaurusResult; expiresAt: number }
const cache = new Map<string, CacheEntry>()

const getCached = (key: string, now = Date.now()) => {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= now) {
    cache.delete(key)
    return undefined
  }
  cache.delete(key)
  cache.set(key, entry)
  return entry.result
}

const setCached = (key: string, result: ThesaurusResult, now = Date.now()) => {
  cache.set(key, { result, expiresAt: now + CACHE_TTL_MS })
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (!oldest) break
    cache.delete(oldest)
  }
}

/** Clears the bounded in-memory thesaurus cache between tests or explicit resets. */
export const clearRhymeThesaurusCache = () => cache.clear()
export const getRhymeThesaurusCacheSize = () => cache.size

type Args = { target: string | null | undefined; enabled: boolean }

type State = {
  status: ThesaurusStatus
  phase: ThesaurusPhase
  result: ThesaurusResult | null
  error?: string
}

/**
 * Fetches meaning alternatives for a normalized rhyme target with latest-request-wins,
 * abortable requests, a small target debounce, and a bounded TTL cache.
 */
export function useRhymeThesaurus({ target, enabled }: Args) {
  const normalizedTarget = useMemo(() => normalizeToken(target ?? ''), [target])
  const [state, setState] = useState<State>({ status: 'idle', phase: 'idle', result: null })
  const requestCounter = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const inFlightKeyRef = useRef<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const consumedRefreshTickRef = useRef(0)
  const debounceRef = useRef<number | null>(null)

  const refresh = useCallback(() => {
    if (!normalizedTarget) return
    cache.delete(normalizedTarget)
    setRefreshTick((tick) => tick + 1)
  }, [normalizedTarget])

  useEffect(() => {
    if (!enabled || !normalizedTarget) {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      abortRef.current?.abort()
      abortRef.current = null
      inFlightKeyRef.current = null
      setState({ status: 'idle', phase: 'idle', result: null, error: undefined })
      return
    }

    const cached = getCached(normalizedTarget)
    if (cached) {
      setState({ status: 'success', phase: 'idle', result: cached })
      return
    }

    if (inFlightKeyRef.current === normalizedTarget) return

    abortRef.current?.abort()
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    setState((prev) => {
      const matchingResult = prev.result?.target === normalizedTarget ? prev.result : null
      return {
        status: 'loading',
        phase: matchingResult ? 'refreshing' : 'initial',
        result: matchingResult,
        error: undefined,
      }
    })

    const controller = new AbortController()
    abortRef.current = controller
    inFlightKeyRef.current = normalizedTarget
    requestCounter.current += 1
    const requestId = requestCounter.current

    const runRequest = () => {
      debounceRef.current = null
      fetchDatamuseThesaurus(normalizedTarget, controller.signal)
        .then((result) => {
          if (controller.signal.aborted || requestId !== requestCounter.current) return
          setCached(normalizedTarget, result)
          setState({ status: 'success', phase: 'idle', result })
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || requestId !== requestCounter.current) return
          const message = error instanceof Error ? error.message : 'Meaning suggestions are temporarily unavailable.'
          setState((prev) => ({ ...prev, status: 'error', phase: 'error', error: message }))
        })
        .finally(() => {
          if (requestId === requestCounter.current) {
            inFlightKeyRef.current = null
            if (abortRef.current === controller) abortRef.current = null
          }
        })
    }

    const shouldRunImmediately = refreshTick > 0 && consumedRefreshTickRef.current !== refreshTick
    if (shouldRunImmediately) {
      consumedRefreshTickRef.current = refreshTick
      runRequest()
    } else {
      debounceRef.current = window.setTimeout(runRequest, TARGET_DEBOUNCE_MS)
    }

    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      controller.abort()
      if (abortRef.current === controller) {
        abortRef.current = null
      }
      if (inFlightKeyRef.current === normalizedTarget) {
        inFlightKeyRef.current = null
      }
    }
  }, [enabled, normalizedTarget, refreshTick])

  return { ...state, normalizedTarget, refresh }
}
