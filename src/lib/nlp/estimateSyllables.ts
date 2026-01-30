import { splitNormalizedTokenForSyllables } from '@/lib/analysis/normalizeTokenForSyllables'
import { countSyllables } from './syllables'

export function estimateSyllables(word: string): number {
  return splitNormalizedTokenForSyllables(word).reduce((sum, token) => sum + countSyllables(token), 0)
}
