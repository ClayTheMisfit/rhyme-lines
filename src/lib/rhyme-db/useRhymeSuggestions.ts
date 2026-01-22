import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Mode, RhymeTargetsDebug, RhymeTokenDebug } from '@/lib/rhyme-db/queryRhymes'
import { getRhymeClient, initRhymeClient } from '@/lib/rhyme-db/rhymeClientSingleton'
import { getCaretWord, getLineLastWord } from '@/lib/rhyme-db/tokenize'
import { estimateSyllables } from '@/lib/nlp/estimateSyllables'
import type { DebounceMode } from '@/lib/persist/schema'

const ALL_MODES = ['perfect', 'near', 'slant'] as const
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

type UseRhymeSuggestionsArgs = {
  text: string
  caretIndex: number
  currentLineText?: string
  currentLineRange?: LineRange
  modes: Mode[]
  max?: number
  multiSyllable?: boolean
  includeRareWords?: boolean
  debounceMode?: DebounceMode
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
  debounceMode,
  enabled,
}: UseRhymeSuggestionsArgs) => {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | undefined>(undefined)
  const [warning, setWarning] = useState<string | undefined>(undefined)
  const [results, setResults] = useState<Results>({})
  const [debug, setDebug] = useState<DebugInfo>({})
  const [wordUsage, setWordUsage] = useState<Record<string, number>>({})
  const [phase, setPhase] = useState<LoadPhase>('idle')
  const lastGoodRef = useRef<Results>({})

  const caretIndexRef = useRef(caretIndex)
  const requestCounter = useRef(0)
  const typingTimer = useRef<number | null>(null)
  const caretTimer = useRef<number | null>(null)
  const usageTimer = useRef<number | null>(null)
  const lastContentRef = useRef({ text: '', lineText: '' })

  useEffect(() => {
    caretIndexRef.current = caretIndex
  }, [caretIndex])

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
        setDebug({
          caretToken: undefined,
          lineLastToken: undefined,
          lastQueryMs: undefined,
          caretDetails: undefined,
          lineLastDetails: undefined,
        })
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

      const desiredToken = lineLastToken ?? caretToken
      const desiredSyllables = desiredToken ? estimateSyllables(desiredToken) : undefined

      const normalizedModes = modes.map((mode) => mode.toLowerCase()).filter(isMode)
      const orderedModes: NormalizedMode[] = normalizedModes.length > 0 ? normalizedModes : [...ALL_MODES]
      try {
        await initRhymeClient()
      } catch (initError) {
        if (requestId !== requestCounter.current) return
        const message = initError instanceof Error ? initError.message : 'Failed to initialize rhyme worker'
        setStatus('error')
        setError(message)
        setPhase('error')
        return
      }

      if (requestId !== requestCounter.current) return
      const initWarning = getRhymeClient().getWarning()
      setWarning(initWarning ?? undefined)

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

        if (requestId !== requestCounter.current) return

        const hasDbUnavailable = settled.some(
          (entry) =>
            entry.status === 'rejected' &&
            (entry.reason as Error & { code?: string }).code === 'DB_UNAVAILABLE'
        )
        if (hasDbUnavailable) {
          setStatus('error')
          setError('Rhyme DB unavailable')
          setPhase('error')
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
              slant: Math.max(acc.slant, item.candidatePools.slant),
            }),
            { perfect: 0, near: 0, slant: 0 }
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
        const mergedResults: Results = {
          caret: mergeList(resultsByMode.map((result) => result.results.caret)),
          lineLast: mergeList(resultsByMode.map((result) => result.results.lineLast)),
        }
        const mergedDebug: RhymeTargetsDebug = {
          caret: mergeDebug(resultsByMode.map((result) => result.debug?.caret)),
          lineLast: mergeDebug(resultsByMode.map((result) => result.debug?.lineLast)),
        }

        if (requestId !== requestCounter.current) return
        setResults(mergedResults)
        lastGoodRef.current = mergedResults
        setStatus('success')
        setPhase('idle')
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
          setStatus('error')
          setError(message)
          setPhase('error')
          return
        }
        const message = queryError instanceof Error ? queryError.message : 'Failed to fetch rhymes'
        setStatus('error')
        setError(message)
        setPhase('error')
      }
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

    const typingDelay = debounceMode === 'cursor-50' ? 50 : 250

    typingTimer.current = window.setTimeout(() => {
      runQuery({ caretToken, lineLastToken })
    }, typingDelay)

    lastContentRef.current = { text, lineText }

    return () => {
      if (typingTimer.current) {
        window.clearTimeout(typingTimer.current)
      }
    }
  }, [debounceMode, enabled, lineText, runQuery, text])

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

  useEffect(() => {
    if (!enabled) return
    const { text: latestText, lineText: latestLineText } = lastContentRef.current
    if (!latestText && !latestLineText) return

    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current)
    }

    const caretToken = getCaretWord(latestText, caretIndexRef.current)
    const lineLastToken = getLineLastWord(latestLineText)
    const typingDelay = debounceMode === 'cursor-50' ? 50 : 250

    typingTimer.current = window.setTimeout(() => {
      runQuery({ caretToken, lineLastToken })
    }, typingDelay)

    return () => {
      if (typingTimer.current) {
        window.clearTimeout(typingTimer.current)
      }
    }
  }, [debounceMode, enabled, includeRareWords, max, modes, multiSyllable, runQuery])

  return {
    status,
    error,
    warning,
    results,
    debug,
    phase,
  }
}
