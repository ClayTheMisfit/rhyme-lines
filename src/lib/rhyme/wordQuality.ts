import { isCommonEnglishWord } from '@/lib/rhyme-db/commonEnglish'
import commonWordRanks from '@/lib/rhyme-db/frequency/commonWordRanks.json'

export type QualityTier = 'common' | 'uncommon' | 'rare' | 'proper' | 'foreign' | 'weird'

type Classification = {
  isProper: boolean
  isForeignLike: boolean
  isWeird: boolean
  commonScore: number
  qualityTier: QualityTier
}

const COMMON_WORD_RANKS = commonWordRanks as Record<string, number>
const MAX_RANK_SCORE = 120000
const COMMON_THRESHOLD = 65000
const UNCOMMON_THRESHOLD = 25000

const KNOWN_NAMES = new Set([
  'haim',
  'heim',
  'seim',
  'syme',
  'braim',
  'chaym',
  'schrime',
])

const FOREIGN_TOKENS = new Set([
  'beim',
  'sein',
  'mein',
  'kein',
  'zum',
  'zur',
  'nicht',
  'auch',
  'sein',
])

const isTitleCase = (word: string) => /^[A-Z][a-z]+$/.test(word)
const hasInnerCaps = (word: string) => /^[A-Z][a-z]+[A-Z]/.test(word) || /[A-Z].+[A-Z]/.test(word)

const getCommonScore = (normalized: string) => {
  const rank = COMMON_WORD_RANKS[normalized]
  const baseScore = typeof rank === 'number' ? Math.max(0, MAX_RANK_SCORE - rank) : 0
  const bonus = isCommonEnglishWord(normalized) ? 50000 : 0
  return baseScore + bonus
}

export const classifyCandidate = (word: string): Classification => {
  const normalized = word.toLowerCase()
  const isWeird = !/^[a-zA-Z'-]+$/.test(word)
  if (isWeird) {
    return {
      isProper: false,
      isForeignLike: false,
      isWeird: true,
      commonScore: 0,
      qualityTier: 'weird',
    }
  }

  const commonScore = getCommonScore(normalized)
  const looksProper =
    KNOWN_NAMES.has(normalized) ||
    hasInnerCaps(word) ||
    (isTitleCase(word) && !isCommonEnglishWord(normalized))
  const isForeignLike = FOREIGN_TOKENS.has(normalized)

  if (isForeignLike) {
    return {
      isProper: looksProper,
      isForeignLike: true,
      isWeird: false,
      commonScore,
      qualityTier: 'foreign',
    }
  }

  if (looksProper) {
    return {
      isProper: true,
      isForeignLike: false,
      isWeird: false,
      commonScore,
      qualityTier: 'proper',
    }
  }

  if (commonScore >= COMMON_THRESHOLD) {
    return {
      isProper: false,
      isForeignLike: false,
      isWeird: false,
      commonScore,
      qualityTier: 'common',
    }
  }

  if (commonScore >= UNCOMMON_THRESHOLD) {
    return {
      isProper: false,
      isForeignLike: false,
      isWeird: false,
      commonScore,
      qualityTier: 'uncommon',
    }
  }

  return {
    isProper: false,
    isForeignLike: false,
    isWeird: false,
    commonScore,
    qualityTier: 'rare',
  }
}

export const QUALITY_TIER_ORDER: Record<QualityTier, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  proper: 3,
  foreign: 4,
  weird: 5,
}
