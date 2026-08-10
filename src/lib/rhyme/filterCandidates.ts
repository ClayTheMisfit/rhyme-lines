import type { RhymeQuality } from './aggregate'
import type { RhymeSuggestionMode } from '@/lib/persist/schema'

export type CanonicalRhymeCandidate = Readonly<{ word: string; category: RhymeQuality }>

export function filterRhymeCandidates(
  candidates: readonly CanonicalRhymeCandidate[],
  mode: RhymeSuggestionMode,
): CanonicalRhymeCandidate[] {
  return mode === 'all' ? [...candidates] : candidates.filter(({ category }) => category === mode)
}
