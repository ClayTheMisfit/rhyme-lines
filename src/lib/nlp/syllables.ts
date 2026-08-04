import { isCommonEnglishWord } from '@/lib/rhyme-db/commonEnglish'
import { countYearSyllables, parseYearToken } from '@/lib/nlp/yearSyllables'
import { getPronunciation, normalizeApostrophes } from '@/lib/phonetics/pronunciation'

const SYLLABLE_OVERRIDES: Record<string, number> = {
  the: 1, a: 1, i: 1, you: 1, are: 1, fire: 1, hour: 1, choir: 1,
  people: 2, every: 2, evening: 3, queue: 1, queued: 1, queues: 1,
  hundred: 2, naked: 2, wicked: 2, crooked: 2, beloved: 3,
  sacred: 2, hatred: 2, wretched: 2, rugged: 2,
  business: 2, camera: 2, chocolate: 2, family: 2, depression: 3, imperfections: 4,
}

const COMPOUND_SUFFIXES = ['out', 'up', 'in', 'on', 'off', 'over'] as const
const FUSED_COMPOUND_ALLOWLIST = new Set(['vibeout', 'fadeout', 'blackout', 'burnout', 'chillout', 'freakout', 'lockout'])
const syllableCache = new Map<string, number>()

function hasSyllabicLeEnding(word: string): boolean {
  return /[bcdfghjklmnpqrstvwxyz]le$/.test(word)
    && !/(?:[aeiou]sle|yle|lle)$/.test(word)
}

export type SyllableContext = {
  previousWord?: string
  nextWord?: string
}

export function countSyllables(wordRaw: string, context?: SyllableContext): number {
  const normalizedInput = wordRaw.toLowerCase().trim()
  if (!normalizedInput) return 0

  const possibleYear = parseYearToken(wordRaw)
  if (possibleYear !== null) {
    return countYearSyllables(possibleYear, countSingleTokenSyllables)
  }

  const learnedAdjective = isLearnedAdjective(normalizedInput, context)
  const cacheKey = learnedAdjective ? `${normalizedInput}\0adjective` : normalizedInput
  const cached = syllableCache.get(cacheKey)
  if (cached !== undefined) return cached

  const parts = normalizedInput.split(/\s+/).filter(Boolean)
  const result = parts.length > 1
    ? parts.reduce((sum, part) => sum + countSingleTokenSyllables(part), 0)
    : learnedAdjective ? 2 : countSingleTokenSyllables(parts[0] ?? '')

  syllableCache.set(cacheKey, result)
  return result
}

function countSingleTokenSyllables(token: string): number {
  const word = normalizeApostrophes(token.toLowerCase()).replace(/[^a-z']/g, '')
  if (!word) return 0

  if (word in SYLLABLE_OVERRIDES) return SYLLABLE_OVERRIDES[word]

  const pronunciation = getPronunciation(word)
  if (pronunciation.normalized && pronunciation.source !== 'heuristic' && pronunciation.syllables > 0) {
    return pronunciation.syllables
  }

  const inflectedCount = estimateInflectedSyllables(word)
  if (inflectedCount !== null) return inflectedCount

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

/**
 * Estimate regular English inflections from their uninflected spelling.
 *
 * A trailing silent e stops being word-final once `s` or `d` is appended, so
 * the generic vowel-group fallback used to count `comes`, `waves`, and
 * `survived` one syllable too high. Deriving the base first also models the
 * usual pronunciation of `-ed`: it adds a syllable only after a t/d sound.
 */
function estimateInflectedSyllables(word: string): number | null {
  if (!/^[a-z]+$/.test(word)) return null

  if (word.endsWith('ed') && word.length > 3) {
    const stem = word.slice(0, -2)
    const base = stem.endsWith('i') ? `${stem.slice(0, -1)}y` : `${stem}e`
    const baseCount = countSingleTokenSyllables(base)
    const pronouncedEnding = /[td]$/.test(stem) ? 1 : 0
    return baseCount + pronouncedEnding
  }

  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) {
    const stem = word.slice(0, -1)
    // An appended `s` hides a silent e from the word-final fallback. Do not
    // apply this after a sibilant spelling, where `-es` is normally spoken
    // (`faces`, `roses`, `judges`).
    if (!/(?:[csxzg]|sh|ch)e$/.test(stem) && stem.endsWith('e')) {
      // Terminal `ie` is already one vowel group in these regular plurals.
      // Running the singular fallback would apply its hiatus rule and add an
      // extra syllable to words such as `movies`, `cookies`, and `pies`.
      if (stem.endsWith('ie')) {
        return Math.max(1, stem.match(/[aeiouy]+/g)?.length ?? 0)
      }

      // Only delegate when the singular's final `le` is itself syllabic. The
      // broad consonant-le fallback also matches silent-e words such as style,
      // aisle, and gazelle, which would add a syllable to their plurals.
      if (hasSyllabicLeEnding(stem)) {
        return countSingleTokenSyllables(stem)
      }

      return Math.max(1, stem.replace(/e$/, '').match(/[aeiouy]+/g)?.length ?? 0)
    }
  }

  return null
}

function isLearnedAdjective(word: string, context?: SyllableContext): boolean {
  if (normalizeApostrophes(word).replace(/[^a-z']/g, '') !== 'learned') return false
  if (!context?.nextWord) return false
  return /^(?:a|an|the)$/i.test(context.previousWord ?? '')
}

function estimateCompoundSuffixSyllables(word: string): number | null {
  if (!/^[a-z]+$/.test(word) || word.length < 6) return null
  if (word in SYLLABLE_OVERRIDES || isCommonEnglishWord(word)) return null

  const isAllowlistedFusion = FUSED_COMPOUND_ALLOWLIST.has(word)

  for (const suffix of COMPOUND_SUFFIXES) {
    if (!word.endsWith(suffix)) continue
    const prefix = word.slice(0, -suffix.length)
    if (prefix.length < 2) continue

    if (!isAllowlistedFusion && !isCommonEnglishWord(prefix)) continue

    return countSingleTokenSyllables(prefix) + countSingleTokenSyllables(suffix)
  }

  return null
}
