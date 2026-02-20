import { countSyllables } from '@/lib/nlp/syllables'
import { normalizeTokenForSyllables } from './normalizeTokenForSyllables'
import { tokenizeLine } from './tokenize'
import type { AnalysisResponseV1 } from './protocol'

export type LineInput = { id: string; text: string }

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())
const DEBUG_TOTAL_MISMATCH = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_SYLLABLE_TOTALS === '1'

export function computeAnalysis(
  lines: LineInput[],
  meta?: { docId?: string; seq?: number }
): AnalysisResponseV1 {
  const start = now()
  const lineTotals: Record<string, number> = {}
  const wordSyllables: Record<string, Array<{ start: number; end: number; syllables: number }>> = {}

  for (const line of lines) {
    // Analysis map:
    // 1) tokenizeLine builds the canonical token list (including grouped tokens like "10 pm").
    // 2) normalizeTokenForSyllables applies pronunciation-only transforms (numbers, ina, am/pm speech).
    // 3) countSyllables computes syllables per canonical token.
    // 4) lineTotals is always the exact sum of this canonical wordSyllables array.
    const canonicalTokens = tokenizeLine(line.text)
    const canonicalWordSyllables = canonicalTokens.map((token) => ({
      start: token.start,
      end: token.end,
      syllables: countSyllables(normalizeTokenForSyllables(token.text)),
    }))

    wordSyllables[line.id] = canonicalWordSyllables
    lineTotals[line.id] = canonicalWordSyllables.reduce((sum, word) => sum + word.syllables, 0)

    if (DEBUG_TOTAL_MISMATCH) {
      const recomputed = wordSyllables[line.id].reduce((sum, word) => sum + word.syllables, 0)
      if (recomputed !== lineTotals[line.id]) {
        // eslint-disable-next-line no-console
        console.debug('[analysis] syllable total mismatch', {
          lineId: line.id,
          text: line.text,
          tokens: canonicalTokens,
          words: wordSyllables[line.id],
          total: lineTotals[line.id],
          recomputed,
        })
      }
    }
  }

  return {
    v: 1,
    seq: meta?.seq ?? -1,
    docId: meta?.docId ?? '',
    lineTotals,
    wordSyllables,
    timing: { computeMs: Math.max(0, now() - start) },
  }
}
