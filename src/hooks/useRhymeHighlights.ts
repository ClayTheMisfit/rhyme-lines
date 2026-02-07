import { useEffect, useMemo, useState } from 'react'
import type { AnalysisResult } from '@/hooks/useAnalysisWorker'
import type { LineInput } from '@/lib/analysis/compute'
import { buildHighlightGroups, type HighlightBuildResult, type HighlightToken } from '@/lib/rhyme/highlightGroups'
import { resolveRhymeKeys } from '@/lib/rhyme/highlightKeyResolver'

type UseRhymeHighlightsArgs = {
  analysis: AnalysisResult
  enabled: boolean
  ignoreStopwords: boolean
  includeExactRepeats: boolean
  lines: LineInput[]
}

const emptyResult: HighlightBuildResult = { groups: [], assignments: new Map() }

export function useRhymeHighlights({
  analysis,
  enabled,
  ignoreStopwords,
  includeExactRepeats,
  lines,
}: UseRhymeHighlightsArgs) {
  const [result, setResult] = useState<HighlightBuildResult>(emptyResult)

  const tokens = useMemo<HighlightToken[]>(() => {
    if (!analysis) return []
    const lineIndexById = new Map(lines.map((line, index) => [line.id, index]))
    const collected: HighlightToken[] = []
    for (const line of lines) {
      const lineTokens = analysis.lineTokens[line.id] ?? []
      for (const token of lineTokens) {
        collected.push({
          lineId: line.id,
          tokenIndex: token.index,
          norm: token.norm,
          text: token.text,
          rhymeKey: null,
        })
      }
    }
    for (const [lineId, lineTokens] of Object.entries(analysis.lineTokens ?? {})) {
      if (lineIndexById.has(lineId)) continue
      for (const token of lineTokens) {
        collected.push({
          lineId,
          tokenIndex: token.index,
          norm: token.norm,
          text: token.text,
          rhymeKey: null,
        })
      }
    }
    return collected
  }, [analysis, lines])

  useEffect(() => {
    let cancelled = false
    if (!enabled || !analysis) {
      setResult(emptyResult)
      return () => {
        cancelled = true
      }
    }

    const run = async () => {
      const norms = tokens.map((token) => token.norm).filter(Boolean)
      const { keys } = await resolveRhymeKeys(norms)
      if (cancelled) return
      const built = buildHighlightGroups({
        tokens,
        includeExactRepeats,
        ignoreStopwords,
        rhymeKeysByNorm: keys,
      })
      setResult(built)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [analysis, enabled, ignoreStopwords, includeExactRepeats, tokens])

  return result
}
