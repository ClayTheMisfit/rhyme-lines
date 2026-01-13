/** @jest-environment node */
import type { RhymeDbV1, RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'
import type { RhymeDbRuntimeMaps, RhymeDbRuntimeLookups } from '@/lib/rhyme-db/queryRhymes'
import { getRhymesForToken } from '@/lib/rhyme-db/queryRhymes'

const buildIndex = (entries: Array<[string, number[]]>): RhymeIndex => {
  const keys = entries.map(([key]) => key)
  const offsets: number[] = [0]
  const wordIds: number[] = []
  for (const [, ids] of entries) {
    wordIds.push(...ids)
    offsets.push(wordIds.length)
  }
  return { keys, offsets, wordIds }
}

const buildKeysByWordId = (index: RhymeIndex, wordCount: number) => {
  const keysByWordId = Array.from({ length: wordCount }, () => [] as string[])
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

const buildDb = () => {
  const words = ['find', 'fine', 'line', 'mine', 'moon', 'tide', 'time', 'times']
  const syllables = [1, 1, 1, 1, 1, 1, 1, 1]
  const freqByWordId = [40, 60, 80, 0, 0, 30, 90, 10]

  const perfect = buildIndex([
    ['AY-D', [5]],
    ['AY-M', [6, 7]],
    ['AY-N', [1, 2, 3]],
    ['AY-ND', [0]],
    ['UW-N', [4]],
  ])

  const vowel = buildIndex([
    ['AY', [0, 1, 2, 3, 5, 6, 7]],
    ['UW', [4]],
  ])

  const coda = buildIndex([
    ['D', [5]],
    ['M', [6]],
    ['M-Z', [7]],
    ['N', [1, 2, 3, 4]],
    ['ND', [0]],
  ])

  const runtime: RhymeDbRuntimeMaps = {
    perfectKeysByWordId: buildKeysByWordId(perfect, words.length),
    vowelKeysByWordId: buildKeysByWordId(vowel, words.length),
    codaKeysByWordId: buildKeysByWordId(coda, words.length),
  }
  const runtimeLookups: RhymeDbRuntimeLookups = {
    wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
  }

  const db: RhymeDbV1 = {
    version: 1,
    generatedAt: new Date(0).toISOString(),
    source: { name: 'cmudict', path: 'fixture' },
    words,
    syllables,
    freqByWordId,
    indexes: {
      perfect,
      vowel,
      coda,
    },
  }

  return Object.assign(db, { runtime, runtimeLookups })
}

describe('queryRhymes', () => {
  const db = buildDb()

  it('returns perfect rhymes deterministically', () => {
    const results = getRhymesForToken(db, 'fine', 'perfect', 10, { includeRare: true })
    expect(results).toEqual(['line', 'mine'])
  })

  it('normalizes mode casing', () => {
    const results = getRhymesForToken(db, 'fine', 'Perfect', 10, { includeRare: true })
    expect(results).toEqual(['line', 'mine'])
  })

  it('ranks near rhymes with matching vowel and coda higher', () => {
    const results = getRhymesForToken(db, 'fine', 'near', 10, { includeRare: true })
    expect(results.indexOf('line')).toBeGreaterThanOrEqual(0)
    expect(results.indexOf('mine')).toBeGreaterThanOrEqual(0)
    expect(results.indexOf('time')).toBeGreaterThan(results.indexOf('line'))
  })

  it('filters slant rhymes by threshold and sorts deterministically', () => {
    const results = getRhymesForToken(db, 'fine', 'slant', 10, { includeRare: true })
    expect(results[0]).toBe('line')
    expect(results).not.toContain('moon')
  })

  it('removes trivial inflections', () => {
    const results = getRhymesForToken(db, 'time', 'perfect', 10)
    expect(results).toEqual([])
  })

  it('filters zero-frequency rhymes when includeRare is false', () => {
    const results = getRhymesForToken(db, 'fine', 'perfect', 10, { includeRare: false })
    expect(results).toEqual(['line'])
  })
})
