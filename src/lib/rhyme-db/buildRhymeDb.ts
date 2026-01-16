import { normalizeLexeme } from '@/lib/rhyme-db/normalizeLexeme'
import { RHYME_DB_VERSION } from '@/lib/rhyme-db/version'
import { buildFrequencyMaps } from '@/lib/rhyme-db/frequency/subtlex'

export type ParsedEntry = {
  word: string
  phonemes: string[]
}

export type RhymeIndex = {
  keys: string[]
  offsets: number[]
  wordIds: number[]
}

export type RhymeDbV1 = {
  version: number
  generatedAt: string
  source: {
    name: 'cmudict'
    path: string
  }
  words: string[]
  syllables: number[]
  freqByWordId?: number[]
  isCommonByWordId?: number[]
  isProperByWordId?: number[]
  indexes: {
    perfect: RhymeIndex
    vowel: RhymeIndex
    coda: RhymeIndex
  }
}

const VOWELS = new Set([
  'AA',
  'AE',
  'AH',
  'AO',
  'AW',
  'AY',
  'EH',
  'ER',
  'EY',
  'IH',
  'IY',
  'OW',
  'OY',
  'UH',
  'UW',
])

const STRESS_REGEX = /\d/g
const PRIMARY_SECONDARY_STRESS_REGEX = /[12]/

const stripStress = (phoneme: string) => phoneme.replace(STRESS_REGEX, '')

const isVowel = (phoneme: string) => VOWELS.has(stripStress(phoneme))

export const countSyllables = (phonemes: string[]) =>
  phonemes.reduce((count, phoneme) => (isVowel(phoneme) ? count + 1 : count), 0)

const lastVowelIndex = (phonemes: string[]) => {
  for (let index = phonemes.length - 1; index >= 0; index -= 1) {
    if (isVowel(phonemes[index])) {
      return index
    }
  }
  return -1
}

const lastStressedVowelIndex = (phonemes: string[]) => {
  for (let index = phonemes.length - 1; index >= 0; index -= 1) {
    const phoneme = phonemes[index]
    if (isVowel(phoneme) && PRIMARY_SECONDARY_STRESS_REGEX.test(phoneme)) {
      return index
    }
  }
  return -1
}

export const getPerfectRhymeKey = (phonemes: string[]) => {
  const stressedIndex = lastStressedVowelIndex(phonemes)
  const targetIndex = stressedIndex !== -1 ? stressedIndex : lastVowelIndex(phonemes)
  if (targetIndex === -1) {
    return null
  }

  return phonemes
    .slice(targetIndex)
    .map((phoneme) => stripStress(phoneme))
    .join('-')
}

export const getVowelKey = (phonemes: string[]) => {
  const targetIndex = lastVowelIndex(phonemes)
  if (targetIndex === -1) {
    return null
  }

  return stripStress(phonemes[targetIndex])
}

export const getCodaKey = (phonemes: string[]) => {
  const targetIndex = lastVowelIndex(phonemes)
  if (targetIndex === -1) {
    return null
  }

  return phonemes
    .slice(targetIndex + 1)
    .map((phoneme) => stripStress(phoneme))
    .join('-')
}

export const parseCmuDict = (content: string): ParsedEntry[] => {
  const entries: ParsedEntry[] = []

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith(';;;')) {
      continue
    }

    const parts = line.split(/\s+/)
    if (parts.length < 2) {
      continue
    }

    const rawWord = parts[0]
    const word = normalizeLexeme(rawWord)
    if (!word) {
      continue
    }
    const phonemes = parts.slice(1)

    if (countSyllables(phonemes) === 0) {
      continue
    }

    entries.push({
      word,
      phonemes,
    })
  }

  return entries
}

const buildIndex = (entries: ParsedEntry[], wordIds: Map<string, number>) => {
  const perfect = new Map<string, Set<number>>()
  const vowel = new Map<string, Set<number>>()
  const coda = new Map<string, Set<number>>()

  const addPosting = (map: Map<string, Set<number>>, key: string, wordId: number) => {
    const existing = map.get(key)
    if (existing) {
      existing.add(wordId)
      return
    }
    map.set(key, new Set([wordId]))
  }

  for (const entry of entries) {
    const wordId = wordIds.get(entry.word)
    if (wordId === undefined) {
      continue
    }

    const perfectKey = getPerfectRhymeKey(entry.phonemes)
    const vowelKey = getVowelKey(entry.phonemes)
    const codaKey = getCodaKey(entry.phonemes)

    if (perfectKey !== null) {
      addPosting(perfect, perfectKey, wordId)
    }
    if (vowelKey !== null) {
      addPosting(vowel, vowelKey, wordId)
    }
    if (codaKey !== null) {
      addPosting(coda, codaKey, wordId)
    }
  }

  const finalize = (map: Map<string, Set<number>>): RhymeIndex => {
    const keys = Array.from(map.keys()).sort()
    const offsets: number[] = [0]
    const wordIdsList: number[] = []

    for (const key of keys) {
      const postings = Array.from(map.get(key) ?? []).sort((a, b) => a - b)
      wordIdsList.push(...postings)
      offsets.push(wordIdsList.length)
    }

    return {
      keys,
      offsets,
      wordIds: wordIdsList,
    }
  }

  return {
    perfect: finalize(perfect),
    vowel: finalize(vowel),
    coda: finalize(coda),
  }
}

export const buildRhymeDb = (entries: ParsedEntry[]): RhymeDbV1 => {
  const { rankByWord, properLike, topN } = buildFrequencyMaps({ topN: 50000 })
  const pronunciationsByWord = new Map<string, ParsedEntry[]>()
  for (const entry of entries) {
    const existing = pronunciationsByWord.get(entry.word)
    if (existing) {
      existing.push(entry)
      continue
    }
    pronunciationsByWord.set(entry.word, [entry])
  }

  const words = Array.from(pronunciationsByWord.keys()).sort()
  const wordIds = new Map<string, number>()
  words.forEach((word, index) => {
    wordIds.set(word, index)
  })

  const syllables = words.map((word) => {
    const pronunciations = pronunciationsByWord.get(word) ?? []
    let minSyllables = Number.POSITIVE_INFINITY
    for (const pronunciation of pronunciations) {
      minSyllables = Math.min(minSyllables, countSyllables(pronunciation.phonemes))
    }
    return Number.isFinite(minSyllables) ? minSyllables : 0
  })

  const freqByWordId = words.map((word) => {
    const rank = rankByWord.get(word) ?? 0
    if (!rank || rank > topN) return 0
    return topN + 1 - Math.min(rank, topN)
  })
  const isProperByWordId = words.map((word) => (properLike.has(word) && word !== 'i' ? 1 : 0))
  const isCommonByWordId = words.map((word, index) => {
    const rank = rankByWord.get(word) ?? 0
    if (rank === 0 || rank > topN) return 0
    return isProperByWordId[index] ? 0 : 1
  })

  if (freqByWordId.length !== words.length) {
    throw new Error(`Frequency map length mismatch: ${freqByWordId.length} vs ${words.length}`)
  }
  if (isCommonByWordId.length !== words.length) {
    throw new Error(`Common map length mismatch: ${isCommonByWordId.length} vs ${words.length}`)
  }
  if (isProperByWordId.length !== words.length) {
    throw new Error(`Proper map length mismatch: ${isProperByWordId.length} vs ${words.length}`)
  }

  return {
    version: RHYME_DB_VERSION,
    generatedAt: new Date(0).toISOString(),
    source: {
      name: 'cmudict',
      path: 'data/cmudict/cmudict.dict',
    },
    words,
    syllables,
    freqByWordId,
    isCommonByWordId,
    isProperByWordId,
    indexes: buildIndex(entries, wordIds),
  }
}
