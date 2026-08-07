import { isCommonEnglishWord } from '@/lib/rhyme-db/commonEnglish'
import commonWordRanks from '@/lib/rhyme-db/frequency/commonWordRanks.json'
import givenNames from '@/lib/rhyme/lexical/usGivenNames.json'

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

export const LEXICAL_POLICY_VERSION = 'proper-names-v3'

const COMMON_WORD_RANKS = commonWordRanks as Record<string, number>
const COMMON_THRESHOLD = 65000
const UNCOMMON_THRESHOLD = 25000
const ORDINARY_EVIDENCE_THRESHOLD = 45000

// Generated from the SSA national given-name corpus and intersected with the
// pronunciation vocabulary at build time. Ordinary lexical evidence below can
// override this risk signal for word/name collisions.
const GIVEN_NAMES = new Set<string>(givenNames)

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
  // commonWordRanks is already an ascending strength score: larger values are
  // more common. Inverting it made rare names look more common than rain.
  const baseScore = typeof rank === 'number' ? rank : 0
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
    commonScore >= ORDINARY_EVIDENCE_THRESHOLD ||
    (hasLexicalPartOfSpeech && typeof evidence.frequency === 'number' && evidence.frequency > 0)
  const looksProper =
    (GIVEN_NAMES.has(normalized) && !hasStrongOrdinaryEvidence) ||
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
  hasKnownNameEvidence: (word: string) => GIVEN_NAMES.has(word.toLowerCase()),
}
