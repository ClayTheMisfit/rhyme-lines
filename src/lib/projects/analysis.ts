import { tokenizeLine } from '@/lib/analysis/tokenize'
import { countSyllables } from '@/lib/nlp/syllables'
import { normalizeLexeme } from '@/lib/rhyme-db/normalizeLexeme'

export interface ProjectAnalysisMetrics {
  rhymeDensity: number
  internalRhymes: number
  endRhymeFamilyCount: number
  averageSyllablesPerLine: number
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

const rhymeFamilyFromToken = (token: string): string => {
  const normalized = normalizeLexeme(token)
  if (!normalized) return ''
  const vowelTail = normalized.match(/[aeiouy][a-z']*$/)?.[0] ?? ''
  if (vowelTail.length >= 2) return vowelTail
  return normalized.slice(-3)
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

  const endFamilies: string[] = []
  let internalRhymes = 0
  let totalSyllables = 0

  for (const line of lines) {
    const lexemes = tokenizeLine(line)
      .map((token) => normalizeLexeme(token.text))
      .filter(Boolean)

    const lineSyllables = lexemes.reduce((sum, token) => sum + countSyllables(token), 0)
    totalSyllables += lineSyllables

    const familyCounts = new Map<string, number>()
    lexemes.forEach((lexeme, index) => {
      const family = rhymeFamilyFromToken(lexeme)
      if (!family) return
      familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1)

      if (index === lexemes.length - 1) {
        endFamilies.push(family)
      }
    })

    for (const count of familyCounts.values()) {
      if (count > 1) internalRhymes += count - 1
    }
  }

  const endFamilyCounts = new Map<string, number>()
  endFamilies.forEach((family) => {
    endFamilyCounts.set(family, (endFamilyCounts.get(family) ?? 0) + 1)
  })

  const repeatedLineEndings = [...endFamilyCounts.values()].reduce((sum, count) => sum + (count > 1 ? count : 0), 0)
  const rhymeDensity = clamp(repeatedLineEndings / Math.max(1, endFamilies.length))

  return {
    rhymeDensity,
    internalRhymes,
    endRhymeFamilyCount: endFamilyCounts.size,
    averageSyllablesPerLine: totalSyllables / lines.length,
  }
}
