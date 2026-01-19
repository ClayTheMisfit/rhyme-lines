import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AggregationResult, RhymeFilterSelection } from '@/lib/rhyme/aggregate'
import { fetchAggregatedRhymesWithProviders } from '@/lib/rhyme/aggregate'
import { onlineProviders } from '@/lib/rhyme/providers'
import type { Mode } from '@/lib/rhyme-db/queryRhymes'
import { getRhymeClient, initRhymeClient } from '@/lib/rhyme-db/rhymeClientSingleton'
import { getCaretWord, getLineLastWord } from '@/lib/rhyme-db/tokenize'
import { estimateSyllables } from '@/lib/nlp/estimateSyllables'
import type { RhymeSource } from '@/lib/rhymes/rhymeSource'
import {
  getPreferredRhymeSource,
  markLocalInitFailed,
} from '@/lib/rhymes/rhymeSource'

const ALL_MODES = ['perfect', 'near', 'slant'] as const
type NormalizedMode = typeof ALL_MODES[number]
const isMode = (value: string): value is NormalizedMode => (ALL_MODES as readonly string[]).includes(value)

type Status = 'idle' | 'loading' | 'success' | 'error'
type LoadPhase = 'idle' | 'initial' | 'refreshing' | 'error'

type LineRange = { start: number; end: number }

type Results = { caret?: string[]; lineLast?: string[] }

type DebugInfo = {
  caretToken?: string
  lineLastToken?: string
  lastQueryMs?: number
}

type Meta = {
  source: RhymeSource
  note?: string
}

type UseRhymeSuggestionsArgs = {
  text: string
  caretIndex: number
  currentLineText?: string
  currentLineRange?: LineRange
  modes: Mode[]
  max?: number
  multiSyllable?: boolean
  includeRareWords?: boolean
  enabled: boolean
}

export const useRhymeSuggestions = ({
  text,
  caretIndex,
  currentLineText,
  currentLineRange,
  modes,
  max,
  multiSyllable,
  includeRareWords,
  enabled,
}: UseRhymeSuggestionsArgs) => {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | undefined>(undefined)
  const [warning, setWarning] = useState<string | undefined>(undefined)
  const [results, setResults] = useState<Results>({})
  const [debug, setDebug] = useState<DebugInfo>({})
  const [wordUsage, setWordUsage] = useState<Record<string, number>>({})
  const [meta, setMeta] = useState<Meta>({ source: 'local' })
  const [phase, setPhase] = useState<LoadPhase>('idle')
  const lastGoodRef = useRef<Results>({})

  const caretIndexRef = useRef(caretIndex)
  const requestCounter = useRef(0)
  const typingTimer = useRef<number | null>(null)
  const caretTimer = useRef<number | null>(null)
  const usageTimer = useRef<number | null>(null)
  const onlineAbortRef = useRef<AbortController | null>(null)
  const lastContentRef = useRef({ text: '', lineText: '' })

  useEffect(() => {
    caretIndexRef.current = caretIndex
  }, [caretIndex])

  useEffect(() => {
    return () => {
      onlineAbortRef.current?.abort()
    }
  }, [])

  const lineText = useMemo(() => {
    if (typeof currentLineText === 'string') {
      return currentLineText
    }
    if (currentLineRange) {
      return text.slice(currentLineRange.start, currentLineRange.end)
    }
    return ''
  }, [currentLineRange, currentLineText, text])

  const runQuery = useCallback(
    async (tokens: { caretToken?: string | null; lineLastToken?: string | null }) => {
      const caretToken = tokens.caretToken ?? null
      const lineLastToken = tokens.lineLastToken ?? null
      if (!enabled) return
      if (!caretToken && !lineLastToken) {
        setResults({})
        lastGoodRef.current = {}
        setStatus('idle')
        setError(undefined)
        setPhase('idle')
        setDebug({ caretToken: undefined, lineLastToken: undefined, lastQueryMs: undefined })
        return
      }

      requestCounter.current += 1
      const requestId = requestCounter.current
      const maxResults = max ?? 100
      const startTime = Date.now()
      setStatus('loading')
      setPhase(Object.keys(lastGoodRef.current).length === 0 ? 'initial' : 'refreshing')
      setError(undefined)
      setWarning(undefined)
      setDebug((prev) => ({
        ...prev,
        caretToken: caretToken ?? undefined,
        lineLastToken: lineLastToken ?? undefined,
      }))

      const preferLocal = getPreferredRhymeSource() === 'local'
      const desiredToken = lineLastToken ?? caretToken
      const desiredSyllables = desiredToken ? estimateSyllables(desiredToken) : undefined

      const buildFilters = (activeModes: Mode[]): RhymeFilterSelection => {
        const normalized = activeModes.map((mode) => mode.toLowerCase()).filter(isMode)
        return {
          perfect: normalized.includes('perfect'),
          near: normalized.includes('near'),
          slant: normalized.includes('slant'),
        }
      }

      const normalizedModes = modes.map((mode) => mode.toLowerCase()).filter(isMode)
      const orderedModes: NormalizedMode[] = normalizedModes.length > 0 ? normalizedModes : [...ALL_MODES]

      const toSuggestions = (result: AggregationResult | null) =>
        result?.suggestions.map((suggestion) => suggestion.word) ?? []

      const fetchOnline = async () => {
        const controller = new AbortController()
        onlineAbortRef.current?.abort()
        onlineAbortRef.current = controller

        const filters = buildFilters(orderedModes)
        const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false

        const caretTarget = caretToken ?? undefined
        const lineTarget = lineLastToken ?? undefined
        const targets =
          caretTarget && lineTarget && caretTarget === lineTarget
            ? [{ key: 'shared', token: caretTarget }]
            : [
                ...(caretTarget ? [{ key: 'caret', token: caretTarget }] : []),
                ...(lineTarget ? [{ key: 'lineLast', token: lineTarget }] : []),
              ]

        const withTimeout = async (promise: Promise<AggregationResult>, timeoutMs: number) => {
          let timeoutId: ReturnType<typeof setTimeout> | null = null
          const timeoutPromise = new Promise<AggregationResult>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Rhyme providers timed out')), timeoutMs)
          })
          try {
            return await Promise.race([promise, timeoutPromise])
          } finally {
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
          }
        }

        const settled = await Promise.allSettled(
          targets.map(async (target) => ({
            key: target.key,
            result: await withTimeout(
              fetchAggregatedRhymesWithProviders(
                target.token,
                {
                  filters,
                  signal: controller.signal,
                  offline: isOffline,
                },
                onlineProviders
              ),
              4500
            ),
          }))
        )

        if (controller.signal.aborted) {
          return { results: {}, allFailed: false, hadFailure: false }
        }

        const outcomes = new Map<string, AggregationResult>()
        let allFailed = true
        let hadFailure = false

        settled.forEach((entry) => {
          if (entry.status === 'fulfilled') {
            outcomes.set(entry.value.key, entry.value.result)
            const entryAllFailed = entry.value.result.providerStates.every(
              (state) => !state.ok && !state.skipped
            )
            const entryHadFailure = entry.value.result.providerStates.some(
              (state) => !state.ok && !state.skipped
            )
            allFailed = allFailed && entryAllFailed
            hadFailure = hadFailure || entryHadFailure
          } else {
            hadFailure = true
          }
        })

        const onlineResults: Results = {}
        const sharedResult = outcomes.get('shared')
        if (sharedResult) {
          const suggestions = toSuggestions(sharedResult)
          onlineResults.caret = suggestions
          onlineResults.lineLast = suggestions
        } else {
          if (outcomes.get('caret')) {
            onlineResults.caret = toSuggestions(outcomes.get('caret') ?? null)
          }
          if (outcomes.get('lineLast')) {
            onlineResults.lineLast = toSuggestions(outcomes.get('lineLast') ?? null)
          }
        }

        return { results: onlineResults, allFailed, hadFailure }
      }

      const applyOnlineFallback = async (note?: string) => {
        setMeta({ source: 'online', note })
        const onlineResponse = await fetchOnline()
        if (requestId !== requestCounter.current) return

        if (onlineResponse.allFailed) {
          const offlineMessage =
            typeof navigator !== 'undefined' && navigator.onLine === false
              ? 'No rhyme data available offline yet. Connect once to download the rhyme pack.'
              : 'Failed to fetch rhymes from online providers.'
          setStatus('error')
          setError(offlineMessage)
          setPhase('error')
          return
        }

        if (onlineResponse.hadFailure) {
          setWarning('Some online providers failed')
        }

        setResults(onlineResponse.results)
        lastGoodRef.current = onlineResponse.results
        setStatus('success')
        setPhase('idle')
        setDebug((prev) => ({
          ...prev,
          lastQueryMs: Date.now() - startTime,
        }))
      }

      // Local pipeline: hook -> client -> worker -> results.
      // Online pipeline: hook -> aggregator -> providers -> merge -> results.
      if (preferLocal) {
        try {
          await initRhymeClient()
          const initWarning = getRhymeClient().getWarning()
          setWarning(initWarning ?? undefined)
        } catch (initError) {
          if (requestId !== requestCounter.current) return
          const message = initError instanceof Error ? initError.message : 'Failed to initialize rhyme worker'
          markLocalInitFailed(message)
          await applyOnlineFallback('Offline DB unavailable — using online providers.')
          return
        }

        try {
          const settled = await Promise.allSettled(
            orderedModes.map((mode) =>
              getRhymeClient().getRhymes({
                targets: {
                  caret: caretToken ?? undefined,
                  lineLast: lineLastToken ?? undefined,
                },
                mode,
                max: maxResults,
                context: {
                  wordUsage,
                  desiredSyllables,
                  multiSyllable: Boolean(multiSyllable),
                  includeRareWords,
                },
              })
            )
          )

          const hasDbUnavailable = settled.some(
            (entry) =>
              entry.status === 'rejected' &&
              (entry.reason as Error & { code?: string }).code === 'DB_UNAVAILABLE'
          )
          if (hasDbUnavailable) {
            const message = 'Rhyme DB unavailable'
            markLocalInitFailed(message)
            await applyOnlineFallback('Offline DB unavailable — using online providers.')
            return
          }

          const fulfilled = settled.filter((entry) => entry.status === 'fulfilled')
          if (fulfilled.length === 0) {
            const message = 'Failed to fetch rhymes'
            setStatus('error')
            setError(message)
            setPhase('error')
            return
          }

          if (fulfilled.length !== settled.length) {
            setWarning('Some rhyme modes failed')
          }

          const mergeList = (list: (string[] | undefined)[]) => {
            const seen = new Set<string>()
            const merged: string[] = []
            for (const group of list) {
              for (const item of group ?? []) {
                if (seen.has(item)) continue
                seen.add(item)
                merged.push(item)
              }
            }
            return merged
          }

          const resultsByMode = fulfilled.map((entry) => (entry as PromiseFulfilledResult<Results>).value)
          const mergedResults: Results = {
            caret: mergeList(resultsByMode.map((result) => result.caret)),
            lineLast: mergeList(resultsByMode.map((result) => result.lineLast)),
          }

          if (requestId !== requestCounter.current) return
          setResults(mergedResults)
          lastGoodRef.current = mergedResults
          setStatus('success')
          setPhase('idle')
          setMeta({ source: 'local' })
          setDebug((prev) => ({
            ...prev,
            lastQueryMs: Date.now() - startTime,
          }))
        } catch (queryError) {
          if (requestId !== requestCounter.current) return
          const errorCode = (queryError as Error & { code?: string }).code
          if (errorCode === 'DB_UNAVAILABLE') {
            const message = queryError instanceof Error ? queryError.message : 'Rhyme DB unavailable'
            markLocalInitFailed(message)
            await applyOnlineFallback('Offline DB unavailable — using online providers.')
            return
          }
          const message = queryError instanceof Error ? queryError.message : 'Failed to fetch rhymes'
          setStatus('error')
          setError(message)
          setPhase('error')
        }
        return
      }

      await applyOnlineFallback('Offline DB unavailable — using online providers.')
    },
    [enabled, includeRareWords, max, modes, multiSyllable, wordUsage]
  )

  useEffect(() => {
    if (usageTimer.current) {
      window.clearTimeout(usageTimer.current)
    }

    usageTimer.current = window.setTimeout(() => {
      const tokens = text
        .toLowerCase()
        .match(/[a-z0-9']+/g)
      if (!tokens) {
        setWordUsage({})
        return
      }

      const counts = new Map<string, number>()
      for (const token of tokens) {
        counts.set(token, (counts.get(token) ?? 0) + 1)
      }

      const entries = Array.from(counts.entries()).sort((a, b) => {
        if (a[1] !== b[1]) return b[1] - a[1]
        return a[0].localeCompare(b[0])
      })

      const limited = entries.slice(0, 5000)
      const usage: Record<string, number> = {}
      for (const [word, count] of limited) {
        usage[word] = count
      }
      setWordUsage(usage)
    }, 250)

    return () => {
      if (usageTimer.current) {
        window.clearTimeout(usageTimer.current)
      }
    }
  }, [text])

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      setResults({})
      setError(undefined)
      setWarning(undefined)
      return
    }

    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current)
    }

    const caretToken = getCaretWord(text, caretIndexRef.current)
    const lineLastToken = getLineLastWord(lineText)

    typingTimer.current = window.setTimeout(() => {
      runQuery({ caretToken, lineLastToken })
    }, 250)

    lastContentRef.current = { text, lineText }

    return () => {
      if (typingTimer.current) {
        window.clearTimeout(typingTimer.current)
      }
    }
  }, [enabled, lineText, runQuery, text])

  useEffect(() => {
    if (!enabled) return
    if (text !== lastContentRef.current.text || lineText !== lastContentRef.current.lineText) {
      return
    }

    if (caretTimer.current) {
      window.clearTimeout(caretTimer.current)
    }

    const caretToken = getCaretWord(text, caretIndex)
    const lineLastToken = getLineLastWord(lineText)

    caretTimer.current = window.setTimeout(() => {
      runQuery({ caretToken, lineLastToken })
    }, 50)

    return () => {
      if (caretTimer.current) {
        window.clearTimeout(caretTimer.current)
      }
    }
  }, [caretIndex, enabled, lineText, runQuery, text])

  return {
    status,
    error,
    warning,
    results,
    debug,
    meta,
    phase,
  }
}
