/** @jest-environment node */
import type { RhymeDbV1, RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'
import { RHYME_DB_VERSION } from '@/lib/rhyme-db/version'
import {
  getRhymesForTargets,
  getRhymesForToken,
  type RhymeDbRuntime,
  type RhymeDbRuntimeMaps,
} from '@/lib/rhyme-db/queryRhymes'

const buildIndex = (entries: Array<{ key: string; wordIds: number[] }>): RhymeIndex => {
  const keys = entries.map((entry) => entry.key)
  const offsets = [0]
  const wordIds: number[] = []

  entries.forEach((entry) => {
    wordIds.push(...entry.wordIds)
    offsets.push(wordIds.length)
  })

  return {
    keys,
    offsets,
    wordIds,
  }
}

const buildRuntimeMaps = (db: RhymeDbV1): RhymeDbRuntimeMaps => {
  const build = (index: RhymeIndex) => {
    const keysByWordId = Array.from({ length: db.words.length }, () => [] as string[])
    index.keys.forEach((key, keyIndex) => {
      const start = index.offsets[keyIndex]
      const end = index.offsets[keyIndex + 1]
      for (let postingIndex = start; postingIndex < end; postingIndex += 1) {
        const wordId = index.wordIds[postingIndex]
        if (wordId !== undefined) {
          keysByWordId[wordId].push(key)
        }
      }
    })
    return keysByWordId
  }

  return {
    perfectKeysByWordId: build(db.indexes.perfect),
    vowelKeysByWordId: build(db.indexes.vowel),
    codaKeysByWordId: build(db.indexes.coda),
  }
}

const createTestDb = (): RhymeDbRuntime => {
  const words = ['blue', 'clue', 'glue', 'shine', 'shoe', 'through', 'true']

  const perfect = buildIndex([
    { key: 'AYN', wordIds: [3] },
    { key: 'UW', wordIds: [0, 5, 6] },
  ])

  const vowel = buildIndex([
    { key: 'AY', wordIds: [3] },
    { key: 'OW', wordIds: [4] },
    { key: 'UW', wordIds: [0, 1, 2, 5, 6] },
  ])

  const coda = buildIndex([
    { key: 'L', wordIds: [0, 1, 2] },
    { key: 'N', wordIds: [3] },
    { key: 'R', wordIds: [5, 6] },
  ])

  const db: RhymeDbV1 = {
    version: RHYME_DB_VERSION,
    generatedAt: new Date(0).toISOString(),
    source: { name: 'cmudict', path: 'data/cmudict/cmudict.dict' },
    words,
    syllables: words.map(() => 1),
    indexes: {
      perfect,
      vowel,
      coda,
    },
  }

  return Object.assign(db, { runtime: buildRuntimeMaps(db) })
}

describe('queryRhymes', () => {
  it('returns perfect rhymes alphabetically and excludes the token', () => {
    const db = createTestDb()
    const result = getRhymesForToken(db, 'blue', 'perfect', 10)

    expect(result).toEqual(['through', 'true'])
    expect(result).not.toContain('blue')
  })

  it('prioritizes near rhymes that appear in both vowel and coda pools', () => {
    const db = createTestDb()
    const result = getRhymesForToken(db, 'blue', 'near', 10)

    expect(result).toEqual(['clue', 'glue', 'through', 'true'])
  })

  it('uses slant fallback suffix matching when token is missing', () => {
    const db = createTestDb()
    const result = getRhymesForToken(db, 'crue', 'slant', 5)

    expect(result).toEqual(['true'])
  })

  it('returns separate results for caret and line-last targets', () => {
    const db = createTestDb()
    const result = getRhymesForTargets(
      db,
      { caret: 'blue', lineLast: 'shine' },
      'perfect',
      5,
      {},
    )

    expect(result.caret).toEqual(['through', 'true'])
    expect(result.lineLast).toEqual([])
  })
})
