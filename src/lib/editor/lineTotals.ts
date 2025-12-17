import { countSyllables } from '@/lib/nlp/syllables'

export function splitNormalizedLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return normalized.split('\n')
}

export function computeLineTotals(text: string, lines?: string[]): number[] {
  const resolvedLines = lines ?? splitNormalizedLines(text)

  return resolvedLines.map((line) => {
    const words = line.split(/\s+/).filter((word) => word.length > 0)
    if (words.length === 0) return 0

    return words.reduce((sum, word) => sum + countSyllables(word), 0)
  })
}
