import { RHYME_DB_VERSION, type RhymeDbV1, type RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'
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
      rhymeDbVersion: RHYME_DB_VERSION,
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
    expect(results).toContain('line')
    expect(results).not.toContain('fine')
  })
})
