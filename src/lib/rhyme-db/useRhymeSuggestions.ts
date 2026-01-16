import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Mode } from '@/lib/rhyme-db/queryRhymes'
import { getRhymeClient, initRhymeClient } from '@/lib/rhyme-db/rhymeClientSingleton'
import { getCaretWord, getLineLastWord } from '@/lib/rhyme-db/tokenize'
import { estimateSyllables } from '@/lib/nlp/estimateSyllables'

type Status = 'idle' | 'loading' | 'ready' | 'error'

type LineRange = { start: number; end: number }

type Results = { caret?: string[]; lineLast?: string[] }

type DebugInfo = {
  caretToken?: string
  lineLastToken?: string
  lastQueryMs?: number
}

type UseRhymeSuggestionsArgs = {
  text: string
  caretIndex: number
  currentLineText?: string
  currentLineRange?: LineRange
  mode: Mode
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
  mode,
  max,
  multiSyllable,
  includeRareWords,
  enabled,
}: UseRhymeSuggestionsArgs) => {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | undefined>(undefined)
  const [results, setResults] = useState<Results>({})
  const [debug, setDebug] = useState<DebugInfo>({})
  const [wordUsage, setWordUsage] = useState<Record<string, number>>({})

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
        setStatus('idle')
        setError(undefined)
        setDebug({ caretToken: undefined, lineLastToken: undefined, lastQueryMs: undefined })
        return
      }

      requestCounter.current += 1
      const requestId = requestCounter.current
      const maxResults = max ?? 100
      const startTime = Date.now()
      setStatus('loading')
      setError(undefined)
      setDebug((prev) => ({
        ...prev,
        caretToken: caretToken ?? undefined,
        lineLastToken: lineLastToken ?? undefined,
      }))

      try {
        await initRhymeClient()
      } catch (initError) {
        if (requestId !== requestCounter.current) return
        const message = initError instanceof Error ? initError.message : 'Failed to initialize rhyme worker'
        setStatus('error')
        setError(message)
        return
      }

      const desiredToken = lineLastToken ?? caretToken
      const desiredSyllables = desiredToken ? estimateSyllables(desiredToken) : undefined

      try {
        const data = await getRhymeClient().getRhymes({
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

        if (requestId !== requestCounter.current) return
        setResults(data)
        setStatus('ready')
        setDebug((prev) => ({
          ...prev,
          lastQueryMs: Date.now() - startTime,
        }))
      } catch (queryError) {
        if (requestId !== requestCounter.current) return
        const message = queryError instanceof Error ? queryError.message : 'Failed to fetch rhymes'
        setStatus('error')
        setError(message)
      }
    },
    [enabled, includeRareWords, max, mode, multiSyllable, wordUsage]
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
    results,
    debug,
  }
}
