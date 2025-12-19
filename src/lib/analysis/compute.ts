import { countSyllables } from '@/lib/nlp/syllables'
import { tokenizeLine } from './tokenize'
import type { AnalysisResponseV1 } from './protocol'

export type LineInput = { id: string; text: string }

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())

export function computeAnalysis(
  lines: LineInput[],
  meta?: { docId?: string; seq?: number }
): AnalysisResponseV1 {
  const start = now()
  const lineTotals: Record<string, number> = {}
  const wordSyllables: Record<string, Array<{ start: number; end: number; syllables: number }>> = {}

  for (const line of lines) {
    const tokens = tokenizeLine(line.text)
    wordSyllables[line.id] = tokens.map((token) => ({
      start: token.start,
      end: token.end,
      syllables: countSyllables(token.text),
    }))
    lineTotals[line.id] = wordSyllables[line.id].reduce((sum, word) => sum + word.syllables, 0)
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
