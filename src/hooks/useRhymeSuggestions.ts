import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { ActiveWord } from '@/lib/editor/getActiveWord'
import type { AggregatedSuggestion, AggregationResult, RhymeFilterSelection } from '@/lib/rhyme/aggregate'
import { fetchAggregatedRhymes } from '@/lib/rhyme/aggregate'
import { buildCacheKey, clearRhymeCache, getCachedRhymes, setCachedRhymes } from '@/lib/rhyme/cache'
import type { RhymeTarget } from '@/lib/rhyme/targetWord'
import { selectTargetWord } from '@/lib/rhyme/targetWord'
import { DebounceOwner } from '@/lib/rhyme/debouncePolicy'
import { trackCacheHit, trackError, trackRequest } from '@/lib/rhyme/telemetry'

interface UseRhymeSuggestionsProps {
  searchQuery: string
  filters: RhymeFilterSelection
  activeWord: ActiveWord | null
  enabled: boolean
  autoRefresh: boolean
  debounceMode: 'cursor-50' | 'typing-250'
}

type Status = 'idle' | 'loading' | 'success' | 'empty' | 'error' | 'offline'

export function useRhymeSuggestions({
  searchQuery,
  filters,
  activeWord,
  enabled,
  autoRefresh,
  debounceMode,
}: UseRhymeSuggestionsProps) {
  const trimmedQuery = searchQuery.trim()
  const [target, setTarget] = useState<RhymeTarget | null>(null)
  const [suggestions, setSuggestions] = useState<AggregatedSuggestion[]>([])
  const [buckets, setBuckets] = useState<AggregationResult['buckets']>({
    perfect: [],
    near: [],
    slant: [],
  })
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const debounceOwner = useMemo(() => new DebounceOwner(), [])
  const abortRef = useRef<AbortController | null>(null)
  const lastTypedWord = useRef<string>('')
  const requestId = useRef(0)
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false
  )

  // Track last typed token from the search box for fallback targeting
  useEffect(() => {
    if (!trimmedQuery) return
    const parts = trimmedQuery.split(/\s+/)
    const candidate = parts[parts.length - 1]
    if (candidate) {
      lastTypedWord.current = candidate
    }
  }, [trimmedQuery])

  // Track caret derived words too
  useEffect(() => {
    if (activeWord?.word) {
      lastTypedWord.current = activeWord.word
    }
  }, [activeWord?.word])

  // Offline / online listeners
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    if (typeof window === 'undefined') return
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const determineTarget = useCallback(
    (mode: 'typing' | 'caret'): RhymeTarget | null => {
      if (mode === 'typing') {
        return selectTargetWord({
          text: trimmedQuery,
          caretIndex: trimmedQuery.length,
          lastTypedWord: lastTypedWord.current,
          sourceHint: 'lastTyped',
        })
      }

      if (activeWord?.word) {
        return selectTargetWord({
          text: activeWord.word,
          caretIndex: activeWord.isAtCaret ? activeWord.word.length : undefined,
          lastTypedWord: lastTypedWord.current,
          sourceHint: activeWord.isAtCaret ? 'caret' : 'lastTyped',
        })
      }

      return null
    },
    [activeWord?.isAtCaret, activeWord?.word, trimmedQuery]
  )

  // Canonical debounce owner for typing/caret changes
  useEffect(() => {
    if (!enabled) return

    const mode: 'typing' | 'caret' = trimmedQuery ? 'typing' : 'caret'
    const schedulerMode = debounceMode === 'cursor-50' ? 'caret' : mode

    const nextTarget = determineTarget(mode)
    debounceOwner.schedule(schedulerMode, () => {
      setTarget(nextTarget)
    })

    return () => {
      debounceOwner.cancelAll()
    }
  }, [debounceMode, determineTarget, enabled, trimmedQuery])

  const runFetch = useCallback(
    async (
      currentTarget: RhymeTarget,
      currentFilters: RhymeFilterSelection,
      offline: boolean,
      force = false
    ) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const key = buildCacheKey(currentTarget.normalized, currentFilters)
      const cached = getCachedRhymes(key)
      if (cached) {
        trackCacheHit()
        setSuggestions(cached.suggestions)
        setBuckets(cached.buckets)
        setStatus(cached.suggestions.length ? 'success' : 'empty')
        setLastUpdatedAt(Date.now())
      }

      if (!autoRefresh && !force) return

      setStatus(offline ? 'offline' : 'loading')
      setError(null)
      requestId.current += 1
      const currentRequestId = requestId.current
      const startTime = Date.now()

      try {
        const result = await fetchAggregatedRhymes(currentTarget.normalized, {
          filters: currentFilters,
          signal: controller.signal,
          offline,
        })

        if (controller.signal.aborted || currentRequestId !== requestId.current) return
        const allProvidersFailed = result.providerStates.every((state) => !state.ok && !state.skipped)
        const hadFailure = result.providerStates.some((state) => !state.ok && !state.skipped)
        setCachedRhymes(key, result)
        setSuggestions(result.suggestions)
        setBuckets(result.buckets)
        if (allProvidersFailed) {
          setError('All providers failed')
          setStatus('error')
          return
        }
        if (hadFailure) {
          setError('Some providers failed')
        }
        setStatus(result.suggestions.length ? 'success' : 'empty')
        setLastUpdatedAt(Date.now())
        trackRequest(Date.now() - startTime)
      } catch (err) {
        if (controller.signal.aborted || currentRequestId !== requestId.current) return
        if ((err as DOMException)?.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Unknown error')
        setStatus(offline ? 'offline' : 'error')
        trackError()
      }
    },
    [autoRefresh]
  )

  // Trigger fetch when target or filters change
  useEffect(() => {
    if (!enabled) return
    if (!target) {
      setStatus(isOffline ? 'offline' : 'idle')
      setSuggestions([])
      setBuckets({ perfect: [], near: [], slant: [] })
      return
    }

    runFetch(target, filters, isOffline)

    return () => {
      abortRef.current?.abort()
    }
  }, [enabled, filters, isOffline, runFetch, target])

  const refetch = useCallback(() => {
    if (!target) return
    runFetch(target, filters, isOffline, true)
  }, [filters, isOffline, runFetch, target])

  const clearCache = useCallback(() => {
    clearRhymeCache()
  }, [])

  return {
    suggestions,
    buckets,
    status,
    error,
    target,
    lastUpdatedAt,
    isOffline,
    refetchSuggestions: refetch,
    clearCache,
  }
}
