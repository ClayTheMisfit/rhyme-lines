import { normalizeTokenForSyllables } from '@/lib/analysis/normalizeTokenForSyllables'
import { countSyllables } from './syllables'

export function estimateSyllables(word: string): number {
  return countSyllables(normalizeTokenForSyllables(word))
}
