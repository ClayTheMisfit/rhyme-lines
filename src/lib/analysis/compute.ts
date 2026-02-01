import { countSyllables } from '@/lib/nlp/syllables'
import { normalizeToken } from '@/lib/rhyme-db/normalizeToken'
import type { RhymeHighlightRuntime } from '@/lib/rhyme/highlightRuntime'
import { buildHighlightGroups, type RhymeHighlightResult, type RhymeKeyResult, type RhymeToken } from '@/lib/rhyme/highlight'
import { getPerfectKeyForWord } from '@/lib/rhyme/highlightRuntime'
import { normalizeTokenForSyllables } from './normalizeTokenForSyllables'
import { tokenizeLine } from './tokenize'
import type { AnalysisResponseV1 } from './protocol'

export type LineInput = { id: string; text: string }

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())

const rhymeKeyCache = new Map<string, RhymeKeyResult>()

export function computeAnalysis(
  lines: LineInput[],
  meta?: {
    docId?: string
    seq?: number
    rhymeHighlights?: { enabled: boolean; includeExactRepeats?: boolean }
    rhymeRuntime?: RhymeHighlightRuntime | null
  }
): AnalysisResponseV1 {
  const start = now()
  const lineTotals: Record<string, number> = {}
  const wordSyllables: Record<string, Array<{ start: number; end: number; syllables: number }>> = {}
  const rhymeTokens: RhymeToken[] = []
  const tokenMetaById: RhymeHighlightResult['tokenMetaById'] = {}
  const rhymeEnabled = meta?.rhymeHighlights?.enabled ?? false

  for (const line of lines) {
    const lineTokens = tokenizeLine(line.text)
    wordSyllables[line.id] = lineTokens.map((token) => ({
      start: token.start,
      end: token.end,
      syllables: countSyllables(normalizeTokenForSyllables(token.text)),
    }))
    lineTotals[line.id] = wordSyllables[line.id].reduce((sum, word) => sum + word.syllables, 0)
    if (rhymeEnabled) {
      lineTokens.forEach((token, tokenIndex) => {
        const norm = normalizeToken(token.text)
        if (!norm) return
        const id = `${line.id}-${tokenIndex}-${token.start}-${token.end}`
        rhymeTokens.push({
          id,
          lineId: line.id,
          start: token.start,
          end: token.end,
          text: token.text,
          norm,
        })
        tokenMetaById[id] = {
          lineId: line.id,
          start: token.start,
          end: token.end,
          text: token.text,
          norm,
        }
      })
    }
  }

  const includeExactRepeats = meta?.rhymeHighlights?.includeExactRepeats ?? false
  let rhymeHighlights: RhymeHighlightResult | undefined
  if (rhymeEnabled) {
    // Integration point: analysis worker populates rhyme highlight groups for the overlay renderer.
    const resolver = meta?.rhymeRuntime
      ? {
          getPerfectKey: (normalized: string) => getPerfectKeyForWord(normalized, meta.rhymeRuntime!),
        }
      : null
    const groups = buildHighlightGroups(rhymeTokens, { includeExactRepeats, resolver, cache: rhymeKeyCache }).groups
    rhymeHighlights = { tokens: rhymeTokens, groups, tokenMetaById }
  }

  return {
    v: 1,
    seq: meta?.seq ?? -1,
    docId: meta?.docId ?? '',
    lineTotals,
    wordSyllables,
    rhymeHighlights,
    timing: { computeMs: Math.max(0, now() - start) },
  }
}
