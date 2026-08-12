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

/** Classifies a phonetic relationship into one mutually exclusive quality tier. */
export const classifyIndexedRhymeQuality = (
  target: IndexedRhyme,
  candidate: IndexedRhyme,
): RhymeQuality | null => {
  if (target.perfectKeys.some((key) => candidate.perfectKeys.includes(key))) return 'perfect'

  const vowelScore = maximumSimilarity(target.vowelKeys, candidate.vowelKeys, vowelSimilarity)
  const codaScore = maximumSimilarity(
    target.codaKeys,
    candidate.codaKeys,
    (left, right) => codaSimilarity(splitCoda(left), splitCoda(right)),
  )

  // Near rhymes retain the same nucleus and a strongly related ending. Slant
  // rhymes broaden either dimension, but still require a useful phonetic link.
  if (vowelScore === 1 && (codaScore >= 0.65 || target.codaKeys.length === 0 || candidate.codaKeys.length === 0)) {
    return 'near'
  }
  if ((vowelScore >= 0.5 || codaScore >= 0.6) && vowelScore * 0.65 + codaScore * 0.35 >= 0.5) {
    return 'slant'
  }
  return null
}
