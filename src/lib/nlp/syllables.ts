import { isCommonEnglishWord } from '@/lib/rhyme-db/commonEnglish'

const SYLLABLE_OVERRIDES: Record<string, number> = {
  the: 1, a: 1, i: 1, you: 1, are: 1, fire: 1, hour: 1, choir: 1,
  people: 2, every: 2, evening: 3, queue: 1, queued: 1, queues: 1,
  business: 2, camera: 2, chocolate: 2, family: 2, depression: 3, imperfections: 4,
}

const COMPOUND_SUFFIXES = ['out', 'up', 'in', 'on', 'off', 'over'] as const
const syllableCache = new Map<string, number>()

export function countSyllables(wordRaw: string): number {
  const normalizedInput = wordRaw.toLowerCase().trim()
  if (!normalizedInput) return 0

  const cached = syllableCache.get(normalizedInput)
  if (cached !== undefined) return cached

  const parts = normalizedInput.split(/\s+/).filter(Boolean)
  const result = parts.length > 1
    ? parts.reduce((sum, part) => sum + countSingleTokenSyllables(part), 0)
    : countSingleTokenSyllables(parts[0] ?? '')

  syllableCache.set(normalizedInput, result)
  return result
}

function countSingleTokenSyllables(token: string): number {
  const word = token.toLowerCase().replace(/[^a-z']/g, '')
  if (!word) return 0

  if (word in SYLLABLE_OVERRIDES) return SYLLABLE_OVERRIDES[word]

  const compoundCount = estimateCompoundSuffixSyllables(word)
  if (compoundCount !== null) return compoundCount

  const core = word.replace(/e\b/, '')
  const vowelGroups = core.match(/[aeiouy]+/g)
  let count = vowelGroups ? vowelGroups.length : 0

  if (/(ion|ian|ious|iest|ial|tia|cius|cian|giu|uo|ie|io|ii|eo|ua)\b/.test(word)) {
    count += 1
  }
  if (/[bcdfghjklmnpqrstvwxyz]le\b/.test(word)) {
    count += 1
  }

  if (/^[ai]$/.test(word)) count = 1

  return Math.max(1, count)
}

function estimateCompoundSuffixSyllables(word: string): number | null {
  if (!/^[a-z]+$/.test(word) || word.length < 6) return null
  if (word in SYLLABLE_OVERRIDES || isCommonEnglishWord(word)) return null

  for (const suffix of COMPOUND_SUFFIXES) {
    if (!word.endsWith(suffix)) continue
    const prefix = word.slice(0, -suffix.length)
    if (prefix.length < 2) continue

    const prefixPlausible = isCommonEnglishWord(prefix) || /[aeiouy]/.test(prefix)
    if (!prefixPlausible) continue

    return countSingleTokenSyllables(prefix) + countSingleTokenSyllables(suffix)
  }

  return null
}
