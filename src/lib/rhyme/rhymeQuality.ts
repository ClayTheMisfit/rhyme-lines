import { codaSimilarity, vowelSimilarity } from '@/lib/rhyme-db/arpabetFeatures'

export const RHYME_QUALITIES = ['perfect', 'near', 'slant'] as const

export type RhymeQuality = (typeof RHYME_QUALITIES)[number]
export type RhymeMode = RhymeQuality | Capitalize<RhymeQuality>

export const normalizeRhymeMode = (mode: RhymeMode): RhymeQuality => {
  switch (mode) {
    case 'perfect':
    case 'Perfect':
      return 'perfect'
    case 'near':
    case 'Near':
      return 'near'
    case 'slant':
    case 'Slant':
      return 'slant'
  }
}

type IndexedRhyme = {
  perfectKeys: readonly string[]
  vowelKeys: readonly string[]
  codaKeys: readonly string[]
}

export const SLANT_MIN_VOWEL_SIMILARITY = 0.5
export const SLANT_MIN_CODA_SIMILARITY = 0.6
export const SLANT_MIN_COMBINED_SIMILARITY = 0.6
export const SLANT_VOWEL_WEIGHT = 0.65
export const SLANT_CODA_WEIGHT = 0.35

export type IndexedRhymeSimilarity = {
  vowel: number
  coda: number
  combined: number
}

const splitCoda = (key: string) => key.split('-').filter(Boolean)

const maximumSimilarity = (
  left: readonly string[],
  right: readonly string[],
  compare: (a: string, b: string) => number,
) => {
  let maximum = 0
  for (const leftKey of left) {
    for (const rightKey of right) maximum = Math.max(maximum, compare(leftKey, rightKey))
  }
  return maximum
}

export const scoreIndexedRhymeSimilarity = (
  target: IndexedRhyme,
  candidate: IndexedRhyme,
): IndexedRhymeSimilarity => {
  const vowel = maximumSimilarity(target.vowelKeys, candidate.vowelKeys, vowelSimilarity)
  const coda = maximumSimilarity(
    target.codaKeys,
    candidate.codaKeys,
    (left, right) => codaSimilarity(splitCoda(left), splitCoda(right)),
  )
  return { vowel, coda, combined: vowel * SLANT_VOWEL_WEIGHT + coda * SLANT_CODA_WEIGHT }
}

/** Classifies a phonetic relationship into one mutually exclusive quality tier. */
export const classifyIndexedRhymeQuality = (
  target: IndexedRhyme,
  candidate: IndexedRhyme,
): RhymeQuality | null => {
  if (target.perfectKeys.some((key) => candidate.perfectKeys.includes(key))) return 'perfect'

  const similarity = scoreIndexedRhymeSimilarity(target, candidate)

  // Near rhymes retain the same nucleus and a strongly related ending. Slant
  // rhymes broaden either dimension, but still require a useful phonetic link.
  if (similarity.vowel === 1 && (similarity.coda >= 0.65 || target.codaKeys.length === 0 || candidate.codaKeys.length === 0)) {
    return 'near'
  }
  // A slant rhyme needs evidence from both the nucleus and ending. The former
  // OR gate admitted most of CMUdict whenever either broad bucket matched.
  if (
    similarity.vowel >= SLANT_MIN_VOWEL_SIMILARITY &&
    similarity.coda >= SLANT_MIN_CODA_SIMILARITY &&
    similarity.combined >= SLANT_MIN_COMBINED_SIMILARITY
  ) {
    return 'slant'
  }
  return null
}
