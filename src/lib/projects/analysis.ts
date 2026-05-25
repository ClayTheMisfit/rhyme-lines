import { tokenizeLine } from '@/lib/analysis/tokenize'
import { countSyllables } from '@/lib/nlp/syllables'
import { normalizeLexeme } from '@/lib/rhyme-db/normalizeLexeme'
import { buildRhymeDecorations } from '@/lib/rhyme/rhymeDecorations'

export interface ProjectAnalysisMetrics {
  rhymeDensity: number
  internalRhymes: number
  endRhymeFamilyCount: number
  averageSyllablesPerLine: number
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

export const analyzeProjectContent = (content: string): ProjectAnalysisMetrics => {
  const lines = content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (!lines.length) {
    return {
      rhymeDensity: 0,
      internalRhymes: 0,
      endRhymeFamilyCount: 0,
      averageSyllablesPerLine: 0,
    }
  }

  let totalSyllables = 0
  const lineInputs = lines.map((text, index) => ({ id: `analysis-line-${index}`, text }))

  for (const line of lines) {
    const lexemes = tokenizeLine(line)
      .map((token) => normalizeLexeme(token.text))
      .filter(Boolean)

    const lineSyllables = lexemes.reduce((sum, token) => sum + countSyllables(token), 0)
    totalSyllables += lineSyllables

  }

  const visibleFamilySnapshot = buildRhymeDecorations(lineInputs, [], {
    showInternalRhymes: true,
    highlightStopwords: false,
  })

  const endFamilies: string[] = []
  let internalRhymes = 0

  for (const tokens of visibleFamilySnapshot.tokensByLine.values()) {
    const counts = new Map<string, number>()
    for (const token of tokens) {
      counts.set(token.familyKey, (counts.get(token.familyKey) ?? 0) + 1)
      if (token.isEndWord) endFamilies.push(token.familyKey)
    }
    for (const count of counts.values()) {
      if (count > 1) internalRhymes += count - 1
    }
  }

  const endFamilyCounts = new Map<string, number>()
  endFamilies.forEach((family) => endFamilyCounts.set(family, (endFamilyCounts.get(family) ?? 0) + 1))
  const repeatedLineEndings = [...endFamilyCounts.values()].reduce((sum, count) => sum + (count > 1 ? count : 0), 0)
  const rhymeDensity = clamp(repeatedLineEndings / Math.max(1, endFamilies.length))

  return {
    rhymeDensity,
    internalRhymes,
    endRhymeFamilyCount: visibleFamilySnapshot.familyCount,
    averageSyllablesPerLine: totalSyllables / lines.length,
  }
}
