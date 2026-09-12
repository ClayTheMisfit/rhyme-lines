import { computeAnalysis, type LineInput } from '@/lib/analysis/compute'
import { tokenizeLine } from '@/lib/analysis/tokenize'
import {
  buildRhymeDecorations,
  getEndWordTokenIndex,
  getRhymeFamilyKey,
} from '@/lib/rhyme/rhymeDecorations'

export interface ProjectAnalysisMetrics {
  totalSyllables: number
  rhymeDensity: number
  internalRhymes: number
  endRhymeFamilyCount: number
  averageSyllablesPerLine: number
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

type EndRhymeMetrics = {
  density: number
  familyCount: number
}

/**
 * End-rhyme density counts analyzable, non-empty line endings. An ending
 * participates when its rhyme family occurs at the end of at least two lines.
 * Decoration filters such as stopword visibility do not affect this domain metric.
 */
const analyzeEndRhymes = (lines: LineInput[]): EndRhymeMetrics => {
  const endingFamilyKeys = lines.flatMap((line) => {
    const tokens = tokenizeLine(line.text)
    const endWordIndex = getEndWordTokenIndex(tokens)
    if (endWordIndex === null) return []
    const ending = tokens[endWordIndex]
    const familyKey = getRhymeFamilyKey(ending.analysisKey ?? ending.text)
    return familyKey ? [familyKey] : []
  })

  if (!endingFamilyKeys.length) return { density: 0, familyCount: 0 }

  const familySizes = new Map<string, number>()
  endingFamilyKeys.forEach((familyKey) => {
    familySizes.set(familyKey, (familySizes.get(familyKey) ?? 0) + 1)
  })

  const repeatedFamilies = new Set(
    [...familySizes.entries()]
      .filter(([, count]) => count >= 2)
      .map(([familyKey]) => familyKey)
  )
  const participatingEndings = endingFamilyKeys.filter((familyKey) => repeatedFamilies.has(familyKey)).length

  return {
    density: clamp(participatingEndings / endingFamilyKeys.length),
    familyCount: repeatedFamilies.size,
  }
}

export const analyzeProjectContent = (content: string): ProjectAnalysisMetrics => {
  const normalized = content.replace(/\r\n?/g, '\n')
  if (!normalized.trim()) {
    return {
      totalSyllables: 0,
      rhymeDensity: 0,
      internalRhymes: 0,
      endRhymeFamilyCount: 0,
      averageSyllablesPerLine: 0,
    }
  }

  // Keep the dashboard's established physical line-count denominator. Blank
  // lines contribute zero syllables but are not analyzable rhyme endings.
  const lines = normalized.split('\n')
  const lineInputs = lines.map((text, index) => ({ id: `analysis-line-${index}`, text }))
  const canonical = computeAnalysis(lineInputs)
  const totalSyllables = Object.values(canonical.lineTotals).reduce((sum, total) => sum + total, 0)
  const endRhymes = analyzeEndRhymes(lineInputs)

  // Internal-rhyme presentation remains on the existing decoration pipeline.
  // It is intentionally separate from the explicit end-rhyme statistics above.
  const decorationSnapshot = buildRhymeDecorations(lineInputs, [], {
    showInternalRhymes: true,
    highlightStopwords: false,
  })
  let internalRhymes = 0
  for (const tokens of decorationSnapshot.tokensByLine.values()) {
    const counts = new Map<string, number>()
    for (const token of tokens) {
      counts.set(token.familyKey, (counts.get(token.familyKey) ?? 0) + 1)
    }
    for (const count of counts.values()) {
      if (count > 1) internalRhymes += count - 1
    }
  }

  return {
    totalSyllables,
    rhymeDensity: endRhymes.density,
    internalRhymes,
    endRhymeFamilyCount: endRhymes.familyCount,
    averageSyllablesPerLine: totalSyllables / lines.length,
  }
}
