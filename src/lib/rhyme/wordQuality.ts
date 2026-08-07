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

export type LexicalEvidence = {
  frequency?: number
  tags?: readonly string[]
}

export const LEXICAL_POLICY_VERSION = 'proper-names-v2'

const COMMON_WORD_RANKS = commonWordRanks as Record<string, number>
const MAX_RANK_SCORE = 120000
const COMMON_THRESHOLD = 65000
const UNCOMMON_THRESHOLD = 25000

// A compact lexical-risk index, rather than an unconditional denylist. These
// CMUdict/provider forms are predominantly given names or surnames in English
// text. A separate ordinary-word signal below deliberately wins for collisions.
// Keep this module-level Set so classification remains O(1) per candidate.
const KNOWN_NAMES = new Set([
  'blaine', 'braim', 'brynn', 'chaym', 'dwayne', 'haim', 'hayne', 'heim',
  'jayne', 'kaine', 'kane', 'layne', 'maine', 'petr', 'schrime', 'seim', 'shane',
  'syme', 'thane', 'wayne', 'zain',
])

// Common lexical forms which are also frequently used as names. Name-list
// membership must never suppress these ordinary uses.
const ORDINARY_NAME_COLLISIONS = new Set([
  'chase', 'grace', 'hope', 'hunter', 'mark', 'rain', 'rose', 'summer', 'will',
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

const hasInnerCaps = (word: string) => /^[A-Z][a-z]+[A-Z]/.test(word) || /[A-Z].+[A-Z]/.test(word)

const getCommonScore = (normalized: string) => {
  const rank = COMMON_WORD_RANKS[normalized]
  const baseScore = typeof rank === 'number' ? Math.max(0, MAX_RANK_SCORE - rank) : 0
  const bonus = isCommonEnglishWord(normalized) ? 50000 : 0
  return baseScore + bonus
}

export const classifyCandidate = (word: string, evidence: LexicalEvidence = {}): Classification => {
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
  const hasLexicalPartOfSpeech = evidence.tags?.some((tag) => /^(n|v|adj|adv)$/i.test(tag)) ?? false
  const hasStrongOrdinaryEvidence =
    isCommonEnglishWord(normalized) ||
    ORDINARY_NAME_COLLISIONS.has(normalized) ||
    (hasLexicalPartOfSpeech && typeof evidence.frequency === 'number' && evidence.frequency > 0)
  const looksProper =
    (KNOWN_NAMES.has(normalized) && !hasStrongOrdinaryEvidence) ||
    (hasInnerCaps(word) && !hasStrongOrdinaryEvidence)
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

export const __testables = {
  hasKnownNameEvidence: (word: string) => KNOWN_NAMES.has(word.toLowerCase()),
  hasOrdinaryNameCollisionEvidence: (word: string) => ORDINARY_NAME_COLLISIONS.has(word.toLowerCase()),
}
