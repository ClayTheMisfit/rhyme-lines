import { tokenizeLine } from '@/lib/analysis/tokenize'
import { countSyllables } from '@/lib/nlp/syllables'
import { isStopword } from '@/lib/nlp/stopwords'
import { normalizeLexeme } from '@/lib/rhyme-db/normalizeLexeme'
import {
  buildRhymeDecorations,
  getEndWordTokenIndex,
  getRhymeFamilyKey,
} from '@/lib/rhyme/rhymeDecorations'

export interface ProjectAnalysisMetrics {
  rhymeDensity: number
  internalRhymes: number
  endRhymeFamilyCount: number
  averageSyllablesPerLine: number
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

/**
 * Rhyme density is the fraction of visible, valid non-empty line endings that
 * participate in a repeated rhyme family. Non-stopword singletons remain in the denominator.
 */
const calculateRhymeDensity = (lines: string[]): number => {
  const endingFamilyKeys = lines.flatMap((line) => {
    const tokens = tokenizeLine(line)
    const endWordIndex = getEndWordTokenIndex(tokens)
    if (endWordIndex === null) return []

    const ending = tokens[endWordIndex]
    if (isStopword(ending.analysisKey ?? ending.text)) return []

    const familyKey = getRhymeFamilyKey(ending.analysisKey ?? ending.text)
    return familyKey ? [familyKey] : []
  })

  if (!endingFamilyKeys.length) return 0

  const familySizes = new Map<string, number>()
  endingFamilyKeys.forEach((familyKey) => {
    familySizes.set(familyKey, (familySizes.get(familyKey) ?? 0) + 1)
  })

  const rhymingEndingCount = endingFamilyKeys.reduce(
    (count, familyKey) => count + ((familySizes.get(familyKey) ?? 0) >= 2 ? 1 : 0),
    0
  )

  return clamp(rhymingEndingCount / endingFamilyKeys.length)
}

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
    const canonicalTokens = tokenizeLine(line)
    const lexemes = canonicalTokens
      .map((token, index) => ({ index, text: normalizeLexeme(token.text) }))
      .filter((token) => token.text)

    const lineSyllables = lexemes.reduce(
      (sum, token) =>
        sum +
        countSyllables(token.text, {
          previousWord: canonicalTokens[token.index - 1]?.text,
          nextWord: canonicalTokens[token.index + 1]?.text,
        }),
      0
    )
    totalSyllables += lineSyllables

  }

  const visibleFamilySnapshot = buildRhymeDecorations(lineInputs, [], {
    showInternalRhymes: true,
    highlightStopwords: false,
  })

  let internalRhymes = 0

  for (const tokens of visibleFamilySnapshot.tokensByLine.values()) {
    const counts = new Map<string, number>()
    for (const token of tokens) {
      counts.set(token.familyKey, (counts.get(token.familyKey) ?? 0) + 1)
    }
    for (const count of counts.values()) {
      if (count > 1) internalRhymes += count - 1
    }
  }

  return {
    rhymeDensity: calculateRhymeDensity(lines),
    internalRhymes,
    endRhymeFamilyCount: visibleFamilySnapshot.familyCount,
    averageSyllablesPerLine: totalSyllables / lines.length,
  }
}
