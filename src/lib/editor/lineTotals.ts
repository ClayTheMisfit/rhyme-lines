import { countSyllables } from '@/lib/nlp/syllables'

export function computeLineTotals(text: string): number[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')

  return lines.map((line) => {
    const words = line.split(/\s+/).filter((word) => word.length > 0)
    if (words.length === 0) return 0

    return words.reduce((sum, word) => sum + countSyllables(word), 0)
  })
}
