import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AggregationResult, RhymeFilterSelection } from '@/lib/rhyme/aggregate'
import { fetchAggregatedRhymesWithProviders } from '@/lib/rhyme/aggregate'
import { onlineProviders } from '@/lib/rhyme/providers'
import type { Mode, RhymeTargetsDebug, RhymeTokenDebug } from '@/lib/rhyme-db/queryRhymes'
import { getRhymeClient, initRhymeClient } from '@/lib/rhyme-db/rhymeClientSingleton'
import { getCaretWord, getLineLastWord } from '@/lib/rhyme-db/tokenize'
import { normalizeToken } from '@/lib/rhyme-db/normalizeToken'
import { estimateSyllables } from '@/lib/nlp/estimateSyllables'
import type { RhymeSource } from '@/lib/rhymes/rhymeSource'
import { classifyCandidate, QUALITY_TIER_ORDER } from '@/lib/rhyme/wordQuality'
import type { RhymeSuggestionDebug, RhymeSuggestionDebugState } from '@/lib/rhyme-db/rhymeDebug'
import { isEnglishWord } from '@/lib/rhyme-db/isEnglishWord'
import {
  getPreferredRhymeSource,
  markLocalInitFailed,
} from '@/lib/rhymes/rhymeSource'

const ALL_MODES = ['perfect', 'near'] as const
type NormalizedMode = typeof ALL_MODES[number]
const isMode = (value: string): value is NormalizedMode => (ALL_MODES as readonly string[]).includes(value)

type Status = 'idle' | 'loading' | 'success' | 'error'
type LoadPhase = 'idle' | 'initial' | 'refreshing' | 'error'

type LineRange = { start: number; end: number }

type Results = { caret?: string[]; lineLast?: string[] }
type WorkerResults = { results: Results; debug?: RhymeTargetsDebug }

type DebugInfo = {
  caretToken?: string
  lineLastToken?: string
  lastQueryMs?: number
  caretDetails?: RhymeTokenDebug
  lineLastDetails?: RhymeTokenDebug
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
  queryToken?: string
  modes: Mode[]
  max?: number
  multiSyllable?: boolean
  showVariants?: boolean
  commonWordsOnly?: boolean
  debug?: boolean
  enabled: boolean
}

export const useRhymeSuggestions = ({
  text,
  caretIndex,
  currentLineText,
  currentLineRange,
  queryToken,
  modes,
  max,
  multiSyllable,
  commonWordsOnly,
  debug: debugEnabled,
  enabled,
}: UseRhymeSuggestionsArgs) => {
  const showVariants = false
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | undefined>(undefined)
  const [warning, setWarning] = useState<string | undefined>(undefined)
  const [results, setResults] = useState<Results>({})
  const [debug, setDebug] = useState<DebugInfo>({})
  const [rhymeDebug, setRhymeDebug] = useState<RhymeSuggestionDebugState>({})
  const [wordUsage, setWordUsage] = useState<Record<string, number>>({})
  const [meta, setMeta] = useState<Meta>({ source: 'local' })
  const [phase, setPhase] = useState<LoadPhase>('idle')
  const lastGoodRef = useRef<Results>({})

  const normalizedQueryToken = useMemo(() => normalizeToken(queryToken ?? ''), [queryToken])
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
    async (tokens: {
      caretToken?: string | null
      lineLastToken?: string | null
      rawCaretToken?: string | null
      rawLineLastToken?: string | null
    }) => {
      const caretToken = tokens.caretToken ?? null
      const lineLastToken = tokens.lineLastToken ?? null
      const rawCaretToken = tokens.rawCaretToken ?? caretToken
      const rawLineLastToken = tokens.rawLineLastToken ?? lineLastToken
      if (!enabled) return
      if (!caretToken && !lineLastToken) {
        setResults({})
        lastGoodRef.current = {}
        setStatus('idle')
        setError(undefined)
        setPhase('idle')
        setDebug({
          caretToken: undefined,
          lineLastToken: undefined,
          lastQueryMs: undefined,
          caretDetails: undefined,
          lineLastDetails: undefined,
        })
        setRhymeDebug({})
        return
      }

      requestCounter.current += 1
      const requestId = requestCounter.current
      const maxResults = max ?? Number.MAX_SAFE_INTEGER
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
          slant: normalized.includes('near'),
        }
      }

      const normalizedModes = modes.map((mode) => mode.toLowerCase()).filter(isMode)
      const orderedModes: NormalizedMode[] = normalizedModes.length > 0 ? normalizedModes : [...ALL_MODES]

      const toSuggestions = (result: AggregationResult | null) =>
        result?.suggestions.map((suggestion) => suggestion.word) ?? []

      const shouldIncludeTier = (tier: string) => {
        if (commonWordsOnly) {
          return tier === 'common' || tier === 'uncommon'
        }
        return true
      }

      const filterAndSort = (items: string[], rawTarget: string | null): { list: string[]; debug?: RhymeSuggestionDebug } => {
        const annotated = items.filter(isEnglishWord).map((word) => {
          const quality = classifyCandidate(word)
          return { word, tier: quality.qualityTier, score: quality.commonScore }
        })
        const rejections: Record<string, number> = {}
        const stageCounts: Record<string, number> = {}
        stageCounts.generated = annotated.length
        const filtered = annotated.filter((entry) => {
          const allowed = shouldIncludeTier(entry.tier)
          if (!allowed && debugEnabled) {
            rejections.common_words_only = (rejections.common_words_only ?? 0) + 1
          }
          return allowed
        })
        stageCounts.afterCommonOnly = filtered.length
        filtered.sort((a, b) => {
          const tierDelta = QUALITY_TIER_ORDER[a.tier] - QUALITY_TIER_ORDER[b.tier]
          if (tierDelta !== 0) return tierDelta
          if (a.score !== b.score) return b.score - a.score
          return a.word.localeCompare(b.word)
        })
        stageCounts.afterRuleFilters = filtered.length
        stageCounts.afterSort = filtered.length
        stageCounts.afterDedupe = filtered.length
        stageCounts.afterCap = filtered.length
        const list = filtered.map((entry) => entry.word)
        if (!debugEnabled || !rawTarget) {
          return { list }
        }
        const normalizedTarget = normalizeToken(rawTarget)
        return {
          list,
          debug: {
            rawTarget,
            normalizedTarget,
            activeModes: orderedModes,
            poolCount: stageCounts.generated,
            filteredCount: list.length,
            stageCounts,
            rejections,
            meta: { updatedAt: Date.now() },
          },
        }
      }

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
        const onlineDebug: RhymeSuggestionDebugState = {}
        const sharedResult = outcomes.get('shared')
        if (sharedResult) {
          const suggestions = toSuggestions(sharedResult)
          const filtered = filterAndSort(suggestions, rawCaretToken ?? null)
          onlineResults.caret = filtered.list
          onlineResults.lineLast = filtered.list
          if (filtered.debug) {
            onlineDebug.caret = filtered.debug
            onlineDebug.lineLast = filtered.debug
          }
        } else {
          if (outcomes.get('caret')) {
            const filtered = filterAndSort(toSuggestions(outcomes.get('caret') ?? null), rawCaretToken ?? null)
            onlineResults.caret = filtered.list
            if (filtered.debug) {
              onlineDebug.caret = filtered.debug
            }
          }
          if (outcomes.get('lineLast')) {
            const filtered = filterAndSort(toSuggestions(outcomes.get('lineLast') ?? null), rawLineLastToken ?? null)
            onlineResults.lineLast = filtered.list
            if (filtered.debug) {
              onlineDebug.lineLast = filtered.debug
            }
          }
        }

        return { results: onlineResults, allFailed, hadFailure, debug: onlineDebug }
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
          caretDetails: undefined,
          lineLastDetails: undefined,
          lastQueryMs: Date.now() - startTime,
        }))
        if (debugEnabled) {
          const withMeta = (entry?: RhymeSuggestionDebug) =>
            entry ? { ...entry, meta: { updatedAt: Date.now() } } : undefined
          setRhymeDebug({
            caret: withMeta(onlineResponse.debug?.caret),
            lineLast: withMeta(onlineResponse.debug?.lineLast),
          })
        } else {
          setRhymeDebug({})
        }
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
                  showVariants,
                  commonWordsOnly,
                  debug: debugEnabled,
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
            let deduped = 0
            for (const group of list) {
              for (const item of group ?? []) {
                if (seen.has(item)) {
                  deduped += 1
                  continue
                }
                seen.add(item)
                merged.push(item)
              }
            }
            // Filter out non-English words after candidate aggregation to preserve upstream ranking.
            const englishMerged = merged.filter(isEnglishWord)
            return { merged: englishMerged, deduped }
          }

          const mergeDebug = (items: Array<RhymeTokenDebug | undefined>): RhymeTokenDebug | undefined => {
            const available = items.filter((item): item is RhymeTokenDebug => Boolean(item))
            if (available.length === 0) return undefined
            const pickFirst = <K extends keyof RhymeTokenDebug>(key: K) => {
              for (const item of available) {
                const value = item[key]
                if (value !== undefined && value !== null) {
                  return value
                }
              }
              return available[0][key] ?? null
            }
            const candidatePools = available.reduce(
              (acc, item) => ({
                perfect: Math.max(acc.perfect, item.candidatePools.perfect),
                near: Math.max(acc.near, item.candidatePools.near),
              }),
              { perfect: 0, near: 0 }
            )
            return {
              normalizedToken: available[0].normalizedToken,
              wordId: pickFirst('wordId') as number | null,
              perfectKey: pickFirst('perfectKey'),
              vowelKey: pickFirst('vowelKey'),
              codaKey: pickFirst('codaKey'),
              candidatePools,
            }
          }

          const resultsByMode = fulfilled.map((entry) => (entry as PromiseFulfilledResult<WorkerResults>).value)
          const caretMerge = mergeList(resultsByMode.map((result) => result.results.caret))
          const lineLastMerge = mergeList(resultsByMode.map((result) => result.results.lineLast))
          const mergedResults: Results = {
            caret: caretMerge.merged,
            lineLast: lineLastMerge.merged,
          }
          const mergedDebug: RhymeTargetsDebug = {
            caret: mergeDebug(resultsByMode.map((result) => result.debug?.caret)),
            lineLast: mergeDebug(resultsByMode.map((result) => result.debug?.lineLast)),
          }
          if (debugEnabled) {
            const buildCombinedDebug = (
              rawTarget: string | null,
              merged: string[],
              deduped: number,
              modeDebugs: Array<RhymeTokenDebug | undefined>
            ): RhymeSuggestionDebug | undefined => {
              if (!rawTarget) return undefined
              const normalizedTarget = normalizeToken(rawTarget)
              const stageKeys = [
                'generated',
                'afterModeFilter',
                'afterCommonOnly',
                'afterRuleFilters',
                'afterDedupe',
                'afterSort',
                'afterCap',
              ] as const
              const stageCounts: Record<string, number> = {}
              for (const key of stageKeys) {
                stageCounts[key] = modeDebugs.reduce((acc, item) => acc + (item?.stageCounts?.[key] ?? 0), 0)
              }
              stageCounts.afterDedupe = merged.length
              stageCounts.afterSort = merged.length
              stageCounts.afterCap = merged.length
              const rejections: Record<string, number> = {}
              for (const item of modeDebugs) {
                if (!item?.rejections) continue
                for (const [reason, count] of Object.entries(item.rejections)) {
                  rejections[reason] = (rejections[reason] ?? 0) + count
                }
              }
              if (deduped > 0) {
                rejections.duplicate = (rejections.duplicate ?? 0) + deduped
              }
              const capInfo = modeDebugs.find((item) => item?.cap?.applied)?.cap
              const poolCount = stageCounts.generated || undefined
              return {
                rawTarget,
                normalizedTarget,
                activeModes: orderedModes,
                poolCount,
                filteredCount: merged.length,
                stageCounts,
                rejections,
                cap: capInfo,
                meta: { updatedAt: Date.now() },
              }
            }
            setRhymeDebug({
              caret: buildCombinedDebug(
                rawCaretToken ?? null,
                caretMerge.merged,
                caretMerge.deduped,
                resultsByMode.map((result) => result.debug?.caret)
              ),
              lineLast: buildCombinedDebug(
                rawLineLastToken ?? null,
                lineLastMerge.merged,
                lineLastMerge.deduped,
                resultsByMode.map((result) => result.debug?.lineLast)
              ),
            })
          } else {
            setRhymeDebug({})
          }

          if (process.env.NODE_ENV !== 'production') {
            const logIfTime = (label: 'caret' | 'lineLast', token: string | null | undefined) => {
              const normalized = normalizeToken(token ?? '')
              if (normalized !== 'time') return
              const modeSnapshots = orderedModes.map((mode, index) => {
                const modeResult = resultsByMode[index]
                const debugInfo = label === 'caret' ? modeResult?.debug?.caret : modeResult?.debug?.lineLast
                const words = (label === 'caret' ? modeResult?.results?.caret : modeResult?.results?.lineLast) ?? []
                return {
                  mode,
                  tokenNormalized: debugInfo?.normalizedToken ?? normalized,
                  wordId: debugInfo?.wordId ?? null,
                  perfectKey: debugInfo?.perfectKey ?? null,
                  vowelKey: debugInfo?.vowelKey ?? null,
                  codaKey: debugInfo?.codaKey ?? null,
                  candidatePools: debugInfo?.candidatePools ?? { perfect: 0, near: 0 },
                  first30: words.slice(0, 30),
                }
              })
              console.debug('[rhyme-db] time debug', { target: label, modes: modeSnapshots })
            }
            logIfTime('caret', caretToken)
            logIfTime('lineLast', lineLastToken)
          }

          if (requestId !== requestCounter.current) return
          setResults(mergedResults)
          lastGoodRef.current = mergedResults
          setStatus('success')
          setPhase('idle')
          setMeta({ source: 'local' })
          setDebug((prev) => ({
            ...prev,
            caretDetails: mergedDebug.caret,
            lineLastDetails: mergedDebug.lineLast,
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
    [commonWordsOnly, debugEnabled, enabled, max, modes, multiSyllable, showVariants, wordUsage]
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

    if (normalizedQueryToken) {
      return
    }

    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current)
    }

    const caretToken = getCaretWord(text, caretIndexRef.current)
    const lineLastToken = getLineLastWord(lineText)

    typingTimer.current = window.setTimeout(() => {
      runQuery({ caretToken, lineLastToken, rawCaretToken: caretToken, rawLineLastToken: lineLastToken })
    }, 250)

    lastContentRef.current = { text, lineText }

    return () => {
      if (typingTimer.current) {
        window.clearTimeout(typingTimer.current)
      }
    }
  }, [enabled, lineText, normalizedQueryToken, runQuery, text])

  useEffect(() => {
    if (!enabled) return
    if (normalizedQueryToken) return
    if (text !== lastContentRef.current.text || lineText !== lastContentRef.current.lineText) {
      return
    }

    if (caretTimer.current) {
      window.clearTimeout(caretTimer.current)
    }

    const caretToken = getCaretWord(text, caretIndex)
    const lineLastToken = getLineLastWord(lineText)

    caretTimer.current = window.setTimeout(() => {
      runQuery({ caretToken, lineLastToken, rawCaretToken: caretToken, rawLineLastToken: lineLastToken })
    }, 50)

    return () => {
      if (caretTimer.current) {
        window.clearTimeout(caretTimer.current)
      }
    }
  }, [caretIndex, enabled, lineText, normalizedQueryToken, runQuery, text])

  useEffect(() => {
    if (!enabled) return
    if (!normalizedQueryToken) return

    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current)
    }

    typingTimer.current = window.setTimeout(() => {
      runQuery({
        caretToken: normalizedQueryToken,
        lineLastToken: normalizedQueryToken,
        rawCaretToken: queryToken ?? normalizedQueryToken,
        rawLineLastToken: queryToken ?? normalizedQueryToken,
      })
    }, 200)

    return () => {
      if (typingTimer.current) {
        window.clearTimeout(typingTimer.current)
      }
    }
  }, [enabled, normalizedQueryToken, runQuery])

  return {
    status,
    error,
    warning,
    results,
    debug,
    rhymeDebug,
    meta,
    phase,
  }
}
