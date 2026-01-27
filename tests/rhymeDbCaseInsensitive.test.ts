import type { RhymeDbV1, RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'
import { RHYME_DB_VERSION } from '@/lib/rhyme-db/version'
import { getRhymesForToken } from '@/lib/rhyme-db/queryRhymes'

const buildIndex = (keys: string[], wordIds: number[]): RhymeIndex => ({
  keys,
  offsets: keys.length === 0 ? [0] : [0, wordIds.length],
  wordIds,
})

describe('getRhymesForToken', () => {
  it('finds rhymes for lowercase tokens when db words are uppercase', () => {
    const perfectIndex = buildIndex(['AYN'], [0, 1, 2])
    const emptyIndex = buildIndex([], [])
    const db = {
      version: RHYME_DB_VERSION,
      words: ['FINE', 'LINE', 'TIME'],
      indexes: {
        perfect: perfectIndex,
        vowel: emptyIndex,
        coda: emptyIndex,
      },
      runtime: {
        perfectKeysByWordId: [['AYN'], ['AYN'], ['AYN']],
        vowelKeysByWordId: [[], [], []],
        codaKeysByWordId: [[], [], []],
      },
    } as RhymeDbV1

    const results = getRhymesForToken(db, 'fine', 'perfect', 100)
    expect(results.words).toContain('line')
    expect(results.words).not.toContain('fine')
  })
})
