import { filterRhymeCandidates, type CanonicalRhymeCandidate } from './filterCandidates'

const candidates: readonly CanonicalRhymeCandidate[] = Object.freeze([
  ...['game', 'name', 'came', 'claim', 'blame', 'frame', 'shame', 'aim', 'fame', 'flame']
    .map((word) => Object.freeze({ word, category: 'perfect' as const })),
  Object.freeze({ word: 'nearCandidate', category: 'near' as const }),
  Object.freeze({ word: 'slantCandidate', category: 'slant' as const }),
])

describe('filterRhymeCandidates', () => {
  it.each([
    ['perfect', ['game', 'name', 'came', 'claim', 'blame', 'frame', 'shame', 'aim', 'fame', 'flame']],
    ['near', ['nearCandidate']],
    ['slant', ['slantCandidate']],
  ] as const)('isolates %s candidates', (mode, words) => {
    expect(filterRhymeCandidates(candidates, mode).map(({ word }) => word)).toEqual(words)
  })

  it('does not mutate or relabel canonical candidates', () => {
    const categories = candidates.map(({ category }) => category)
    for (const mode of ['all', 'perfect', 'near', 'slant'] as const) filterRhymeCandidates(candidates, mode)
    expect(candidates.map(({ category }) => category)).toEqual(categories)
  })

  it('does not fall back to all for an empty category', () => {
    const perfectOnly = candidates.filter(({ category }) => category === 'perfect')
    expect(filterRhymeCandidates(perfectOnly, 'near')).toEqual([])
    expect(filterRhymeCandidates(perfectOnly, 'slant')).toEqual([])
  })
})
