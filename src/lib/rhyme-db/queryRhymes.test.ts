/** @jest-environment node */
import type { RhymeDbV1, RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'
import { RHYME_DB_VERSION } from '@/lib/rhyme-db/version'
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
  const isCommonByWordId = freqByWordId.map((freq) => (freq > 0 ? 1 : 0))

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
    version: RHYME_DB_VERSION,
    generatedAt: new Date(0).toISOString(),
    source: { name: 'cmudict', path: 'fixture' },
    words,
    syllables,
    freqByWordId,
    isCommonByWordId,
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
    const results = getRhymesForToken(db, 'fine', 'perfect', 10)
    expect(results.words).toEqual(['line', 'mine'])
  })

  it('normalizes mode casing', () => {
    const results = getRhymesForToken(db, 'fine', 'Perfect', 10)
    expect(results.words).toEqual(['line', 'mine'])
  })

  it('ranks near rhymes with matching vowel and coda higher', () => {
    const results = getRhymesForToken(db, 'fine', 'near', 10)
    expect(results.words).toEqual(expect.arrayContaining(['time', 'tide']))
    expect(results.words).not.toEqual(expect.arrayContaining(['line', 'mine']))
  })

  it('avoids coda-only pooling in near mode', () => {
    const results = getRhymesForToken(db, 'fine', 'near', 10)
    expect(results.words).not.toContain('moon')
  })

  it('does not admit a candidate when only its coda is related', () => {
    const results = getRhymesForToken(db, 'fine', 'Slant', 10)
    expect(results.words).not.toContain('moon')
    expect(results.words).not.toEqual(expect.arrayContaining(['line', 'mine', 'find', 'time']))
  })

  it('removes trivial inflections', () => {
    const results = getRhymesForToken(db, 'time', 'perfect', 10)
    expect(results.words).toEqual([])
  })

  it('filters to common rhymes by default', () => {
    const results = getRhymesForToken(db, 'fine', 'perfect', 10)
    expect(results.words).toEqual(['line', 'mine'])
  })

  it('emits debug stage counts when enabled', () => {
    const results = getRhymesForToken(db, 'fine', 'perfect', 10, { debug: true })
    expect(results.debug.stageCounts?.generated).toBeGreaterThan(0)
    expect(results.debug.stageCounts?.afterCap).toBe(results.words.length)
  })

  it('ranks common time rhymes ahead of obscure entries when frequency is available', () => {
    const words = ['time', 'rhyme', 'prime', 'dime', 'chyme']
    const perfect = buildIndex([['AY-M', [0, 1, 2, 3, 4]]])
    const empty = buildIndex([])
    const runtime: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(perfect, words.length),
      vowelKeysByWordId: buildKeysByWordId(empty, words.length),
      codaKeysByWordId: buildKeysByWordId(empty, words.length),
    }
    const runtimeLookups: RhymeDbRuntimeLookups = {
      wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbWithFreq = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words,
        syllables: [1, 1, 1, 1, 1],
        freqByWordId: [50, 80, 70, 60, 0],
        isCommonByWordId: [1, 1, 1, 1, 0],
        indexes: {
          perfect,
          vowel: empty,
          coda: empty,
        },
      } satisfies RhymeDbV1,
      { runtime, runtimeLookups }
    )

    const results = getRhymesForToken(dbWithFreq, 'time', 'perfect', 10)
    expect(results.words.slice(0, 3).sort()).toEqual(['dime', 'prime', 'rhyme'])
    expect(results.words).toContain('chyme')
  })

  it('ranks common time rhymes ahead of obscure ones', () => {
    const words = ['time', 'rhyme', 'prime', 'dime', 'beim']
    const perfect = buildIndex([['AY-M', [0, 1, 2, 3, 4]]])
    const empty = buildIndex([])
    const runtime: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(perfect, words.length),
      vowelKeysByWordId: buildKeysByWordId(empty, words.length),
      codaKeysByWordId: buildKeysByWordId(empty, words.length),
    }
    const runtimeLookups: RhymeDbRuntimeLookups = {
      wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbWithFreq = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words,
        syllables: [1, 1, 1, 1, 1],
        freqByWordId: [50, 80, 70, 60, 0],
        isCommonByWordId: [1, 1, 1, 1, 0],
        indexes: {
          perfect,
          vowel: empty,
          coda: empty,
        },
      } satisfies RhymeDbV1,
      { runtime, runtimeLookups }
    )

    const commonOnly = getRhymesForToken(dbWithFreq, 'time', 'perfect', 10)
    expect(commonOnly.words.slice(0, 3).sort()).toEqual(['dime', 'prime', 'rhyme'])
  })

  it('includes proper nouns by default', () => {
    const words = ['time', 'dime', 'rhyme', 'haim', "i'm"]
    const perfect = buildIndex([['AY-M', [0, 1, 2, 3, 4]]])
    const empty = buildIndex([])
    const runtime: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(perfect, words.length),
      vowelKeysByWordId: buildKeysByWordId(empty, words.length),
      codaKeysByWordId: buildKeysByWordId(empty, words.length),
    }
    const runtimeLookups: RhymeDbRuntimeLookups = {
      wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbStrict = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words,
        syllables: [1, 1, 1, 1, 1],
        freqByWordId: [50, 40, 30, 0, 0],
        isCommonByWordId: [1, 1, 1, 0, 0],
        indexes: {
          perfect,
          vowel: empty,
          coda: empty,
        },
      } satisfies RhymeDbV1,
      { runtime, runtimeLookups }
    )

    const results = getRhymesForToken(dbStrict, 'time', 'perfect', 10)
    expect(results.words).toEqual(expect.arrayContaining(['rhyme', 'dime', "i'm", 'haim']))
  })

  it('excludes rare words when commonWordsOnly is true', () => {
    const words = ['time', 'dime', 'rhyme', 'zyme']
    const perfect = buildIndex([['AY-M', [0, 1, 2, 3]]])
    const empty = buildIndex([])
    const runtime: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(perfect, words.length),
      vowelKeysByWordId: buildKeysByWordId(empty, words.length),
      codaKeysByWordId: buildKeysByWordId(empty, words.length),
    }
    const runtimeLookups: RhymeDbRuntimeLookups = {
      wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbWithRare = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words,
        syllables: [1, 1, 1, 1],
        freqByWordId: [50, 40, 30, 0],
        isCommonByWordId: [1, 1, 1, 0],
        indexes: {
          perfect,
          vowel: empty,
          coda: empty,
        },
      } satisfies RhymeDbV1,
      { runtime, runtimeLookups }
    )

    const commonOnly = getRhymesForToken(dbWithRare, 'time', 'perfect', 10, { commonWordsOnly: true })
    expect(commonOnly.words).toEqual(['dime', 'rhyme'])
  })

  it('keeps near rhymes when the target coda is empty', () => {
    const words = ['toe', 'flow']
    const vowel = buildIndex([['OW', [0, 1]]])
    const empty = buildIndex([])
    const runtime: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(empty, words.length),
      vowelKeysByWordId: buildKeysByWordId(vowel, words.length),
      codaKeysByWordId: buildKeysByWordId(empty, words.length),
    }
    const runtimeLookups: RhymeDbRuntimeLookups = {
      wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbWithEmptyCoda = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words,
        syllables: [1, 1],
        freqByWordId: [10, 10],
        isCommonByWordId: [1, 1],
        indexes: {
          perfect: empty,
          vowel,
          coda: empty,
        },
      } satisfies RhymeDbV1,
      { runtime, runtimeLookups }
    )

    const results = getRhymesForToken(dbWithEmptyCoda, 'toe', 'near', 10)
    expect(results.words).toEqual(['flow'])
  })

  it('does not promote perfect stopword matches into near mode', () => {
    const words = ['skill', 'will', 'still', 'chill', 'fill', 'bill', 'in', 'is', 'his', 'when', 'did', 'does', 'good', 'even']
    const vowel = buildIndex([['IH', words.map((_, idx) => idx)]])
    const coda = buildIndex([['L', words.map((_, idx) => idx)]])
    const perfect = buildIndex([['IH-L', words.map((_, idx) => idx)]])
    const runtime: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(perfect, words.length),
      vowelKeysByWordId: buildKeysByWordId(vowel, words.length),
      codaKeysByWordId: buildKeysByWordId(coda, words.length),
    }
    const runtimeLookups: RhymeDbRuntimeLookups = {
      wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbWithStopwords = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words,
        syllables: words.map(() => 1),
        freqByWordId: words.map(() => 50),
        isCommonByWordId: words.map(() => 1),
        indexes: {
          perfect,
          vowel,
          coda,
        },
      } satisfies RhymeDbV1,
      { runtime, runtimeLookups }
    )

    const results = getRhymesForToken(dbWithStopwords, 'skill', 'near', 50)
    expect(results.words).not.toEqual(expect.arrayContaining(['will', 'still']))
    expect(results.words).not.toEqual(expect.arrayContaining(['chill', 'fill', 'bill']))
    expect(results.words).not.toEqual(expect.arrayContaining(['in', 'is', 'his', 'when', 'did', 'does', 'good', 'even']))
  })

  it('does not duplicate perfect rhymes into the near bucket', () => {
    const words = ['time', 'rhyme', 'prime', 'dime', 'room', 'game', 'name', 'came', 'home', "i'm"]
    const perfect = buildIndex([['AY-M', [0, 1, 2, 3, 9]]])
    const vowel = buildIndex([
      ['AY', [0, 1, 2, 3, 9]],
      ['UW', [4]],
      ['EY', [5, 6, 7]],
      ['OW', [8]],
    ])
    const coda = buildIndex([
      ['M', [0, 1, 2, 3, 4, 8, 9]],
      ['M-AY', [5, 6, 7]],
    ])
    const runtime: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(perfect, words.length),
      vowelKeysByWordId: buildKeysByWordId(vowel, words.length),
      codaKeysByWordId: buildKeysByWordId(coda, words.length),
    }
    const runtimeLookups: RhymeDbRuntimeLookups = {
      wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbWithNear = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words,
        syllables: words.map(() => 1),
        freqByWordId: words.map(() => 50),
        isCommonByWordId: words.map(() => 1),
        indexes: {
          perfect,
          vowel,
          coda,
        },
      } satisfies RhymeDbV1,
      { runtime, runtimeLookups }
    )

    const results = getRhymesForToken(dbWithNear, 'time', 'near', 20)
    expect(results.words).not.toEqual(expect.arrayContaining(['rhyme', 'prime', 'dime']))
    const excluded = ['room', 'home', 'game', 'name', 'came']
    for (const word of excluded) {
      expect(results.words).not.toContain(word)
    }
    expect(results.words).not.toContain("i'm")
  })

  it('normalizes punctuation for token lookup', () => {
    const clean = getRhymesForToken(db, 'time', 'near', 10)
    const punctuated = getRhymesForToken(db, 'time,', 'near', 10)
    expect(punctuated.words).toEqual(clean.words)
  })

  it('considers all target pronunciations when building near/slant candidate pools', () => {
    // Scenario: Word "either" has two distinct pronunciations with different vowels
    // Pronunciation 1: EY-DH-ER (vowel: EY, coda: DH-ER)
    // Pronunciation 2: IY-DH-ER (vowel: IY, coda: DH-ER)
    //
    // The fix ensures that both vowel keys (EY and IY) are used when building candidate pools,
    // rather than just selecting a single "primary" vowel key.
    //
    // For NEAR mode:
    // - Candidate pool = all words with EXACT match to ANY target vowel key (EY or IY)
    // - Quality classification downstream filters to words with vowelScore=1 AND good coda match
    //
    // For SLANT mode:
    // - Candidate pool = words with vowelSimilarity >= 0.5 to ANY target vowel key
    // - Also includes words with codaSimilarity >= 0.6 to ANY target coda key

    const words = ['either', 'breather', 'neither', 'player', 'layer', 'prayer']

    // "either" (wordId 0): has BOTH EY and IY vowels, coda DH-ER
    // "breather" (wordId 1): vowel IY, coda DH-ER - perfect rhyme with either's IY pronunciation
    // "neither" (wordId 2): has BOTH EY and IY vowels, coda DH-ER - perfect rhyme
    // "player" (wordId 3): vowel EY, coda ER - near rhyme (exact EY vowel, different but related coda)
    // "layer" (wordId 4): vowel EY, coda ER - near rhyme (exact EY vowel, different but related coda)
    // "prayer" (wordId 5): vowel EY, coda ER - near rhyme (exact EY vowel, different but related coda)

    const perfect = buildIndex([
      ['EY-DH-ER', [0, 2]], // either(pronunciation 1), neither(pronunciation 1)
      ['EY-ER', [3, 4, 5]], // player, layer, prayer
      ['IY-DH-ER', [0, 1, 2]], // either(pronunciation 2), breather, neither(pronunciation 2)
    ])

    const vowel = buildIndex([
      ['EY', [0, 2, 3, 4, 5]], // either(pron 1), neither(pron 1), player, layer, prayer
      ['IY', [0, 1, 2]], // either(pron 2), breather, neither(pron 2)
    ])

    const coda = buildIndex([
      ['DH-ER', [0, 1, 2]], // either, breather, neither
      ['ER', [3, 4, 5]], // player, layer, prayer
    ])

    const runtime: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(perfect, words.length),
      vowelKeysByWordId: buildKeysByWordId(vowel, words.length),
      codaKeysByWordId: buildKeysByWordId(coda, words.length),
    }
    const runtimeLookups: RhymeDbRuntimeLookups = {
      wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbWithAltPronunciations = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words,
        syllables: [2, 2, 2, 2, 2, 2],
        freqByWordId: [50, 40, 45, 35, 33, 30],
        isCommonByWordId: [1, 1, 1, 1, 1, 1],
        indexes: {
          perfect,
          vowel,
          coda,
        },
      } satisfies RhymeDbV1,
      { runtime, runtimeLookups }
    )

    // Test NEAR mode: should find candidates with EXACT vowel match to ANY of "either"'s vowel keys
    // Near mode candidate pool = words with vowel EY OR vowel IY (exact matches only)
    // Then classifyIndexedRhymeQuality filters to those with vowelScore=1 and good coda
    const nearResults = getRhymesForToken(dbWithAltPronunciations, 'either', 'near', 10)

    // Perfect rhymes (breather, neither) should be excluded from near mode results
    expect(nearResults.words).not.toContain('breather')
    expect(nearResults.words).not.toContain('neither')

    // Near rhymes: player, layer, prayer all have exact EY vowel match (to either's first pronunciation)
    // and their coda (ER) is related to either's coda (DH-ER) with codaSimilarity >= 0.65
    // This validates that the EY pronunciation is being considered (not just IY)
    // If only the IY pronunciation were used, these would not appear in results
    expect(nearResults.words).toEqual(expect.arrayContaining(['player', 'layer', 'prayer']))

    // Test SLANT mode with a different word that benefits from fuzzy similarity across multiple pronunciations
    // Using "neither" which also has both EY and IY vowels
    // We'll add words with similar (but not exact) vowels to test fuzzy matching
    const wordsSlant = ['neither', 'ither', 'blether', 'tether', 'feather', 'leather']
    // "neither" (0): vowels EY and IY, coda DH-ER
    // "blether" (2): vowel EH, coda DH-ER - EH has 0.75 similarity to EY (differ only in tense)
    // "tether" (3): vowel EH, coda DH-ER
    // "feather" (4): vowel EH, coda DH-ER
    // "leather" (5): vowel EH, coda DH-ER
    // "either" (1): vowels EY and IY, coda DH-ER

    const perfectSlant = buildIndex([
      ['EY-DH-ER', [0, 1]], // neither(pron 1), either(pron 1)
      ['IY-DH-ER', [0, 1]], // neither(pron 2), either(pron 2)
      ['EH-DH-ER', [2, 3, 4, 5]], // blether, tether, feather, leather
    ])

    const vowelSlant = buildIndex([
      ['EH', [2, 3, 4, 5]], // blether, tether, feather, leather
      ['EY', [0, 1]], // neither, either
      ['IY', [0, 1]], // neither, either
    ])

    const codaSlant = buildIndex([
      ['DH-ER', [0, 1, 2, 3, 4, 5]], // all words
    ])

    const runtimeSlant: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(perfectSlant, wordsSlant.length),
      vowelKeysByWordId: buildKeysByWordId(vowelSlant, wordsSlant.length),
      codaKeysByWordId: buildKeysByWordId(codaSlant, wordsSlant.length),
    }
    const runtimeLookupsSlant: RhymeDbRuntimeLookups = {
      wordToId: new Map(wordsSlant.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbSlant = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words: wordsSlant,
        syllables: [2, 2, 2, 2, 2, 2],
        freqByWordId: [45, 50, 30, 33, 35, 32],
        isCommonByWordId: [1, 1, 1, 1, 1, 1],
        indexes: {
          perfect: perfectSlant,
          vowel: vowelSlant,
          coda: codaSlant,
        },
      } satisfies RhymeDbV1,
      { runtime: runtimeSlant, runtimeLookups: runtimeLookupsSlant }
    )

    // Test SLANT mode: should find candidates via fuzzy vowel similarity to ANY target vowel key
    // EH has vowelSimilarity(EH, EY) = 0.75 (3/4 features match)
    // This passes the >= 0.5 threshold for slant mode candidate pool inclusion
    const slantResults = getRhymesForToken(dbSlant, 'neither', 'slant', 10)

    // Should NOT include perfect rhyme (either)
    expect(slantResults.words).not.toContain('either')

    // Should include slant rhymes: blether, tether, feather, leather
    // (EH vowel has 0.75 similarity to neither's EY vowel key)
    expect(slantResults.words).toEqual(expect.arrayContaining(['blether', 'tether', 'feather', 'leather']))
  })

  it('allows multi-syllable results when the toggle is off', () => {
    const words = ['walking', 'talking', 'overwalking']
    const perfect = buildIndex([['AO-K-ING', [0, 1, 2]]])
    const perfect2 = buildIndex([['K-ING', [0, 1, 2]]])
    const empty = buildIndex([])
    const runtime: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(perfect, words.length),
      perfect2KeysByWordId: buildKeysByWordId(perfect2, words.length),
      vowelKeysByWordId: buildKeysByWordId(empty, words.length),
      codaKeysByWordId: buildKeysByWordId(empty, words.length),
    }
    const runtimeLookups: RhymeDbRuntimeLookups = {
      wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbWithMulti = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words,
        syllables: [2, 2, 3],
        freqByWordId: [50, 50, 50],
        isCommonByWordId: [1, 1, 1],
        indexes: {
          perfect,
          perfect2,
          vowel: empty,
          coda: empty,
        },
      } satisfies RhymeDbV1,
      { runtime, runtimeLookups }
    )

    const single = getRhymesForToken(dbWithMulti, 'walking', 'perfect', 10, { multiSyllable: false })
    expect(single.words).toContain('talking')
    expect(single.words).toContain('overwalking')

    const multi = getRhymesForToken(dbWithMulti, 'walking', 'perfect', 10, { multiSyllable: true })
    expect(multi.words).toContain('talking')
    expect(multi.words).toContain('overwalking')
  })

  it('excludes rare variants when commonWordsOnly is true for perfect rhymes', () => {
    const words = ['mat', 'cat', 'bat', 'fat', 'hat', 'rat', 'sat', 'vat', 'pat', 'chat', 'flat', 'brat', 'spat', 'scat', 'splat', 'bhatt', 'blatt', 'batt', 'pratt']
    const perfect = buildIndex([['AE-T', words.map((_, idx) => idx)]])
    const empty = buildIndex([])
    const runtime: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(perfect, words.length),
      vowelKeysByWordId: buildKeysByWordId(empty, words.length),
      codaKeysByWordId: buildKeysByWordId(empty, words.length),
    }
    const runtimeLookups: RhymeDbRuntimeLookups = {
      wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbWithVariants = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words,
        syllables: words.map(() => 1),
        freqByWordId: words.map(() => 0),
        isCommonByWordId: words.map(() => 0),
        indexes: {
          perfect,
          vowel: empty,
          coda: empty,
        },
      } satisfies RhymeDbV1,
      { runtime, runtimeLookups }
    )

    const results = getRhymesForToken(dbWithVariants, 'mat', 'perfect', 200, { commonWordsOnly: true })
    expect(results.words).toEqual(expect.arrayContaining(['cat', 'bat', 'fat', 'hat', 'rat', 'sat', 'vat', 'pat']))
    expect(results.words).not.toContain('bhatt')
    expect(results.words).not.toContain('blatt')
    expect(results.words).not.toContain('batt')
    expect(results.words).not.toContain('pratt')
  })

  it('excludes rare variants by default but keeps common words first', () => {
    const words = ['mat', 'cat', 'bat', 'fat', 'hat', 'rat', 'sat', 'vat', 'pat', 'chat', 'flat', 'brat', 'spat', 'scat', 'splat', 'bhatt', 'blatt', 'batt', 'pratt']
    const perfect = buildIndex([['AE-T', words.map((_, idx) => idx)]])
    const empty = buildIndex([])
    const runtime: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(perfect, words.length),
      vowelKeysByWordId: buildKeysByWordId(empty, words.length),
      codaKeysByWordId: buildKeysByWordId(empty, words.length),
    }
    const runtimeLookups: RhymeDbRuntimeLookups = {
      wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbWithVariants = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words,
        syllables: words.map(() => 1),
        freqByWordId: words.map(() => 0),
        isCommonByWordId: words.map(() => 0),
        indexes: {
          perfect,
          vowel: empty,
          coda: empty,
        },
      } satisfies RhymeDbV1,
      { runtime, runtimeLookups }
    )

    const results = getRhymesForToken(dbWithVariants, 'mat', 'perfect', 200)
    expect(results.words).not.toEqual(expect.arrayContaining(['bhatt', 'blatt', 'batt', 'pratt']))
    expect(results.words.indexOf('cat')).toBeGreaterThanOrEqual(0)
  })

  it('includes variants when showVariants is enabled without rare words', () => {
    const words = ['mat', 'cat', 'bat', 'bhatt', 'blatt', 'batt', 'pratt']
    const perfect = buildIndex([['AE-T', words.map((_, idx) => idx)]])
    const empty = buildIndex([])
    const runtime: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(perfect, words.length),
      vowelKeysByWordId: buildKeysByWordId(empty, words.length),
      codaKeysByWordId: buildKeysByWordId(empty, words.length),
    }
    const runtimeLookups: RhymeDbRuntimeLookups = {
      wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbWithVariants = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words,
        syllables: words.map(() => 1),
        freqByWordId: words.map(() => 0),
        isCommonByWordId: words.map(() => 0),
        indexes: {
          perfect,
          vowel: empty,
          coda: empty,
        },
      } satisfies RhymeDbV1,
      { runtime, runtimeLookups }
    )

    const results = getRhymesForToken(dbWithVariants, 'mat', 'perfect', 200, { showVariants: true })
    expect(results.words).toEqual(expect.arrayContaining(['bhatt', 'blatt', 'batt', 'pratt']))
  })

  it('excludes variants when commonWordsOnly is false and showVariants is off', () => {
    const words = ['mat', 'bhatt', 'blatt']
    const perfect = buildIndex([['AE-T', words.map((_, idx) => idx)]])
    const empty = buildIndex([])
    const runtime: RhymeDbRuntimeMaps = {
      perfectKeysByWordId: buildKeysByWordId(perfect, words.length),
      vowelKeysByWordId: buildKeysByWordId(empty, words.length),
      codaKeysByWordId: buildKeysByWordId(empty, words.length),
    }
    const runtimeLookups: RhymeDbRuntimeLookups = {
      wordToId: new Map(words.map((word, index) => [word.toLowerCase(), index])),
    }

    const dbWithVariants = Object.assign(
      {
        version: RHYME_DB_VERSION,
        generatedAt: new Date(0).toISOString(),
        source: { name: 'cmudict', path: 'fixture' },
        words,
        syllables: words.map(() => 1),
        freqByWordId: words.map(() => 0),
        isCommonByWordId: words.map(() => 0),
        indexes: {
          perfect,
          vowel: empty,
          coda: empty,
        },
      } satisfies RhymeDbV1,
      { runtime, runtimeLookups }
    )

    const results = getRhymesForToken(dbWithVariants, 'mat', 'perfect', 200)
    expect(results.words).not.toContain('bhatt')
    expect(results.words).not.toContain('blatt')
  })
})
