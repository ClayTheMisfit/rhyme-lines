import type { RhymeDbV1, RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'
import {
  codaSimilarity,
  vowelSimilarity,
} from '@/lib/rhyme-db/arpabetFeatures'
import { isCommonEnglishWord } from '@/lib/rhyme-db/commonEnglish'
import { classifyCandidate, QUALITY_TIER_ORDER, type QualityTier } from '@/lib/rhyme/wordQuality'
import { normalizeToken } from '@/lib/rhyme-db/normalizeToken'

export { normalizeToken }

export type Mode = 'perfect' | 'near' | 'Perfect' | 'Near'

export type RhymeDbRuntimeMaps = {
  perfectKeysByWordId: string[][]
  perfect2KeysByWordId?: string[][]
  vowelKeysByWordId: string[][]
  codaKeysByWordId: string[][]
}

export type RhymeDbRuntimeLookups = {
  wordToId: Map<string, number>
}

export type RhymeDbRuntime = Omit<RhymeDbV1, 'runtime'> & {
  runtime?: RhymeDbRuntimeMaps
  runtimeLookups?: RhymeDbRuntimeLookups
}

export type RhymeQueryContext = {
  wordUsage?: Record<string, number>
  desiredSyllables?: number
  multiSyllable?: boolean
  includeRare?: boolean
  includeRareWords?: boolean
  commonWordsOnly?: boolean
  showVariants?: boolean
  debugSource?: 'caret' | 'lineLast'
}

const MAX_RESULTS = 500
const MAX_CANDIDATES = 2000

const normalizeMode = (mode: Mode) => mode.toLowerCase() as 'perfect' | 'near'

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'but',
  'by',
  'did',
  'do',
  'does',
  'even',
  'for',
  'from',
  'good',
  'had',
  'has',
  'have',
  'he',
  'her',
  'hers',
  'him',
  'his',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'me',
  'my',
  'no',
  'not',
  'of',
  'on',
  'or',
  'our',
  'ours',
  'out',
  'she',
  'still',
  'so',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'theirs',
  'this',
  'to',
  'too',
  'up',
  'us',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
  'will',
  'you',
  'your',
])

const STOPWORD_WHITELIST = new Set(['will', 'still'])

const MIN_WORD_LENGTH = 3
const NEAR_BASE_SCORE = 200
const PERFECT_MATCH_SCORE = 1000
const EXACT_CODA_SCORE = 80
const MAX_CODA_SCORE = 60
const CONTRACTION_PENALTY = -40
const COMMON_FUNCTION_PENALTY = -20
const COMMON_FUNCTION_WORDS = new Set(["i'm", 'im'])

export type RhymeTokenDebug = {
  normalizedToken: string
  wordId: number | null
  perfectKey?: string | null
  vowelKey?: string | null
  codaKey?: string | null
  perfectTailLenUsed?: 1 | 2
  candidatePools: { perfect: number; near: number }
  poolSize?: number
  afterModeMatchCount?: number
  afterRareRankOrFilterCount?: number
  tierCounts?: Record<QualityTier, number>
  topCandidates?: Array<{ word: string; tier: QualityTier; score: number }>
  vowelPoolSize?: number
  codaPoolSize?: number
  combinedUniqueCount?: number
  renderedCount?: number
  afterGates?: { near: number }
  thresholds?: { near: number }
}

export type RhymeTokenResult = {
  words: string[]
  debug: RhymeTokenDebug
}

const findWordIdExact = (words: string[], token: string) => {
  let low = 0
  let high = words.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const value = words[mid]
    if (value === token) {
      return mid
    }
    if (value < token) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return -1
}

export const findWordId = (db: RhymeDbRuntime, token: string) => {
  const lookups = db.runtimeLookups
  if (lookups?.wordToId) {
    const directId = lookups.wordToId.get(token)
    if (directId !== undefined) {
      return directId
    }
  }
  const candidates = [token, token.toUpperCase(), token.toLowerCase()]
  for (const candidate of candidates) {
    const id = findWordIdExact(db.words, candidate)
    if (id !== -1) {
      return id
    }
  }
  return -1
}

const findKeyIndex = (keys: string[], key: string) => {
  let low = 0
  let high = keys.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const value = keys[mid]
    if (value === key) {
      return mid
    }
    if (value < key) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return -1
}

const getPosting = (index: RhymeIndex, key: string) => {
  const keyIndex = findKeyIndex(index.keys, key)
  if (keyIndex === -1) {
    return []
  }

  const start = index.offsets[keyIndex]
  const end = index.offsets[keyIndex + 1]
  return index.wordIds.slice(start, end)
}

type KeysByWordIdKind = 'perfectKeysByWordId' | 'perfect2KeysByWordId' | 'vowelKeysByWordId' | 'codaKeysByWordId'

const getKeysForWordId = (db: RhymeDbRuntime, wordId: number, kind: KeysByWordIdKind) => {
  const runtime = db.runtime
  if (!runtime) {
    return []
  }

  const keyList = runtime[kind]
  if (!keyList) {
    return []
  }
  return keyList[wordId] ?? []
}

const collectWordIds = (index: RhymeIndex, keys: string[]) => {
  const results = new Set<number>()
  for (const key of keys) {
    const posting = getPosting(index, key)
    for (const wordId of posting) {
      results.add(wordId)
    }
  }
  return results
}

const selectKey = (index: RhymeIndex, keys: string[]) => {
  if (keys.length === 0) return null
  let bestKey = keys[0]
  let bestSize = -1
  for (const key of keys) {
    const postingSize = getPosting(index, key).length
    if (postingSize > bestSize || (postingSize === bestSize && key < bestKey)) {
      bestSize = postingSize
      bestKey = key
    }
  }
  return bestKey
}

const splitCodaKey = (key: string) => {
  if (!key) return []
  return key.split('-').filter(Boolean)
}

const getNearVowelScore = (targetVowel: string, candidateVowel: string) => {
  const similarity = vowelSimilarity(targetVowel, candidateVowel)
  if (similarity === 1) return 1
  if (similarity >= 0.5) return 0.7
  return 0
}

const getBestVowelKey = (candidateKeys: string[], targetVowel: string) => {
  if (candidateKeys.length === 0) return null
  let bestKey = candidateKeys[0]
  let bestScore = getNearVowelScore(targetVowel, bestKey)
  for (const key of candidateKeys) {
    const score = getNearVowelScore(targetVowel, key)
    if (score > bestScore || (score === bestScore && key < bestKey)) {
      bestScore = score
      bestKey = key
    }
  }
  return bestKey
}

const getBestCodaKey = (candidateKeys: string[], targetCoda: string[]) => {
  if (candidateKeys.length === 0) return null
  let bestKey = candidateKeys[0]
  let bestScore = codaSimilarity(targetCoda, splitCodaKey(bestKey))
  for (const key of candidateKeys) {
    const score = codaSimilarity(targetCoda, splitCodaKey(key))
    if (score > bestScore || (score === bestScore && key < bestKey)) {
      bestScore = score
      bestKey = key
    }
  }
  return bestKey
}

const isTrivialInflection = (token: string, candidate: string) => {
  const suffixes = ['s', 'es', 'ed', 'ing']
  for (const suffix of suffixes) {
    if (candidate === `${token}${suffix}`) return true
    if (token === `${candidate}${suffix}`) return true
  }
  return false
}

const getSyllableDistance = (db: RhymeDbRuntime, wordId: number, target?: number) => {
  if (typeof target !== 'number' || Number.isNaN(target) || target <= 0) {
    return 0
  }
  const candidateSyllables = db.syllables?.[wordId] ?? 0
  return Math.abs(candidateSyllables - target)
}

const compareEntries = (a: RankedEntry, b: RankedEntry) => {
  if (typeof a.syllableDelta === 'number' && typeof b.syllableDelta === 'number' && a.syllableDelta !== b.syllableDelta) {
    return a.syllableDelta - b.syllableDelta
  }
  if (a.modeScore !== b.modeScore) return b.modeScore - a.modeScore
  if (typeof a.codaScore === 'number' && typeof b.codaScore === 'number' && a.codaScore !== b.codaScore) {
    return b.codaScore - a.codaScore
  }
  const tierDelta = QUALITY_TIER_ORDER[a.qualityTier] - QUALITY_TIER_ORDER[b.qualityTier]
  if (tierDelta !== 0) return tierDelta
  if (a.commonScore !== b.commonScore) return b.commonScore - a.commonScore
  if (a.freq !== b.freq) return b.freq - a.freq
  if (a.syllableDistance !== b.syllableDistance) return a.syllableDistance - b.syllableDistance
  return a.normalizedWord.localeCompare(b.normalizedWord)
}

const shouldAllowWord = (word: string) => {
  if (word.length < MIN_WORD_LENGTH) return false
  if (STOPWORDS.has(word) && !STOPWORD_WHITELIST.has(word)) return false
  return true
}

const codaSimilarityForKey = (aKey: string, bKey: string) =>
  codaSimilarity(splitCodaKey(aKey), splitCodaKey(bKey))

const maxCodaSimilarity = (candidateKeys: string[], targetKeys: string[]) => {
  if (candidateKeys.length === 0 || targetKeys.length === 0) {
    return 1
  }
  let best = 0
  for (const candKey of candidateKeys) {
    for (const targetKey of targetKeys) {
      const score = codaSimilarityForKey(candKey, targetKey)
      if (score > best) {
        best = score
      }
    }
  }
  return best
}

const isNonNullable = <T,>(value: T | null | undefined): value is T => value != null

const scorePenalties = (word: string) => {
  let penalty = 0
  if (word.includes("'")) {
    penalty += CONTRACTION_PENALTY
  }
  if (COMMON_FUNCTION_WORDS.has(word)) {
    penalty += COMMON_FUNCTION_PENALTY
  }
  return penalty
}

const scoreCodaSimilarity = (candidateKeys: string[], targetKeys: string[]) => {
  if (candidateKeys.length === 0 || targetKeys.length === 0) return 0
  const similarity = maxCodaSimilarity(candidateKeys, targetKeys)
  if (similarity === 1) return EXACT_CODA_SCORE
  return Math.round(similarity * MAX_CODA_SCORE)
}

const isVariantSpelling = (word: string, commonScore: number) => {
  const normalized = word.toLowerCase()
  if (isCommonEnglishWord(normalized)) return false
  if (/[^a-z']/.test(normalized)) return true
  if (normalized.startsWith('bh')) return true
  if (/(.)\1$/.test(normalized)) return true
  if (normalized.endsWith('att') && commonScore === 0) return true
  return false
}

type RankedEntry = {
  word: string
  normalizedWord: string
  qualityTier: QualityTier
  commonScore: number
  modeScore: number
  freq: number
  syllableDistance: number
  isCommon: boolean
  commonFlag: number
  syllableDelta?: number
  codaScore?: number
}

type RankedMeta = RankedEntry & {
  id: number
  vowelMatches: boolean
  codaMatches: boolean
  codaScore: number
  syllableDelta: number | undefined
}

let warnedFreqInvariant = false

const logSuggestionDebug = (context: RhymeQueryContext, payload: {
  token: string
  includeRare: boolean
  freqAvailable: boolean
  totalCount: number
  commonCount: number
  unknownCount: number
  finalCount: number
  entries: RankedEntry[]
}) => {
  if (process.env.NODE_ENV === 'production') return
  if (context.debugSource !== 'caret') return
  const top10 = payload.entries.slice(0, 10).map((entry) => ({
    w: entry.word,
    freq: entry.freq,
    score: entry.modeScore,
    syll: entry.syllableDistance,
  }))
  console.debug('[rhyme-db] suggestions', {
    token: payload.token,
    includeRare: payload.includeRare,
    freqAvailable: payload.freqAvailable,
    total: payload.totalCount,
    common: payload.commonCount,
    unknown: payload.unknownCount,
    final: payload.finalCount,
    top10,
  })
}

export const getRhymesForToken = (
  db: RhymeDbV1,
  token: string,
  mode: Mode,
  max: number,
  context: RhymeQueryContext = {},
): RhymeTokenResult => {
  const normalized = normalizeToken(token)
  if (!normalized || max <= 0) {
    return {
      words: [],
      debug: {
        normalizedToken: normalized,
        wordId: null,
        perfectKey: null,
        vowelKey: null,
        codaKey: null,
        candidatePools: { perfect: 0, near: 0 },
      },
    }
  }

  const runtimeDb = db as RhymeDbRuntime
  const normalizedMode = normalizeMode(mode)
  const freqAvailable =
    Array.isArray(runtimeDb.freqByWordId) && runtimeDb.freqByWordId.length === runtimeDb.words.length
  const includeRareWords = context.includeRareWords ?? context.includeRare ?? false
  const getFrequency = (id: number) => (freqAvailable ? runtimeDb.freqByWordId?.[id] ?? 0 : 0)
  const limit = Math.min(max, MAX_RESULTS)
  if (!freqAvailable && process.env.NODE_ENV !== 'production' && !warnedFreqInvariant) {
    warnedFreqInvariant = true
    console.warn('[rhyme-db] frequency data unavailable', {
      freqAvailable,
      wordsLen: runtimeDb.words.length,
      freqLen: runtimeDb.freqByWordId?.length ?? 0,
    })
  }

  const isBaseAllowed = (word: string) => {
    if (!shouldAllowWord(word)) return false
    if (!/[a-z]/.test(word)) return false
    return true
  }
  const commonWordsOnly = context.commonWordsOnly ?? false
  const showVariants = context.showVariants ?? false
  const shouldIncludeTier = (tier: QualityTier) => {
    if (commonWordsOnly) {
      return tier === 'common' || tier === 'uncommon'
    }
    if (includeRareWords) return true
    return tier === 'common' || tier === 'uncommon'
  }
  const getTierCounts = (entries: RankedEntry[]) =>
    entries.reduce(
      (acc, entry) => {
        acc[entry.qualityTier] += 1
        return acc
      },
      {
        common: 0,
        uncommon: 0,
        rare: 0,
        proper: 0,
        foreign: 0,
        weird: 0,
      }
    )

  const wordId = findWordId(runtimeDb, normalized)
  if (wordId === -1) {
    if (normalizedMode !== 'near') {
      return {
        words: [],
        debug: {
          normalizedToken: normalized,
          wordId: null,
          perfectKey: null,
          vowelKey: null,
          codaKey: null,
          candidatePools: { perfect: 0, near: 0 },
        },
      }
    }
    const suffixLength = Math.min(3, normalized.length)
    if (suffixLength < 2) {
      return {
        words: [],
        debug: {
          normalizedToken: normalized,
          wordId: null,
          perfectKey: null,
          vowelKey: null,
          codaKey: null,
          candidatePools: { perfect: 0, near: 0 },
        },
      }
    }
    const suffix = normalized.slice(-suffixLength)
    const metadata = db.words
      .map((word, id) => {
        const candidate = word.toLowerCase()
        if (!candidate.endsWith(suffix)) return null
        const freq = getFrequency(id)
        const quality = classifyCandidate(word)
        const commonFlag = isCommonEnglishWord(candidate) ? 1 : 0
        return {
          word,
          normalizedWord: candidate,
          qualityTier: quality.qualityTier,
          commonScore: quality.commonScore,
          modeScore: 0,
          freq,
          syllableDistance: 0,
          isCommon: commonFlag === 1,
          commonFlag,
        }
      })
      .filter((entry): entry is RankedEntry => Boolean(entry))
    const filtered = metadata
      .filter((entry) => isBaseAllowed(entry.normalizedWord))
      .filter((entry) => shouldIncludeTier(entry.qualityTier))
      .filter((entry) => includeRareWords || showVariants || !isVariantSpelling(entry.normalizedWord, entry.commonScore))
    filtered.sort((a, b) => compareEntries(a, b))
    const tierCounts = getTierCounts(filtered)
    const topCandidates = filtered.slice(0, 10).map((entry) => ({
      word: entry.word,
      tier: entry.qualityTier,
      score: entry.commonScore,
    }))
    logSuggestionDebug(context, {
      token: normalized,
      includeRare: includeRareWords,
      freqAvailable,
      totalCount: metadata.length,
      commonCount: metadata.filter((entry) => entry.isCommon).length,
      unknownCount: metadata.filter((entry) => !entry.isCommon).length,
      finalCount: filtered.length,
      entries: filtered,
    })
    return {
      words: filtered.slice(0, limit).map((entry) => entry.word),
      debug: {
        normalizedToken: normalized,
        wordId: null,
        perfectKey: null,
        vowelKey: null,
        codaKey: null,
        candidatePools: { perfect: 0, near: metadata.length },
        poolSize: metadata.length,
        afterModeMatchCount: metadata.length,
        afterRareRankOrFilterCount: filtered.length,
        tierCounts: process.env.NODE_ENV !== 'production' ? tierCounts : undefined,
        topCandidates: process.env.NODE_ENV !== 'production' ? topCandidates : undefined,
      },
    }
  }

  const targetSyllables = (runtimeDb.syllables?.[wordId] ?? 0) || context.desiredSyllables
  const resolvedTargetSyllables =
    typeof targetSyllables === 'number' && targetSyllables > 0 ? targetSyllables : undefined
  const useMultiSyllablePerfect = normalizedMode === 'perfect' && context.multiSyllable
  const targetPerfect2Keys = useMultiSyllablePerfect && runtimeDb.runtime?.perfect2KeysByWordId
    ? getKeysForWordId(runtimeDb, wordId, 'perfect2KeysByWordId')
    : []
  const useTwoTail = Boolean(
    useMultiSyllablePerfect &&
      resolvedTargetSyllables &&
      resolvedTargetSyllables > 1 &&
      targetPerfect2Keys.length > 0
  )
  const tailKeyKind: KeysByWordIdKind =
    useTwoTail &&
    resolvedTargetSyllables &&
    resolvedTargetSyllables > 1 &&
    runtimeDb.runtime?.perfect2KeysByWordId
      ? 'perfect2KeysByWordId'
      : 'perfectKeysByWordId'
  const targetTailKeys = getKeysForWordId(runtimeDb, wordId, tailKeyKind)
  const matchesTailKeys = (candidateId: number) => {
    if (targetTailKeys.length === 0) return true
    const candidateKeys = getKeysForWordId(runtimeDb, candidateId, tailKeyKind)
    return candidateKeys.some((key) => targetTailKeys.includes(key))
  }
  const getSyllableDelta = (candidateId: number) => {
    if (!resolvedTargetSyllables) return undefined
    const candidateSyllables = runtimeDb.syllables?.[candidateId]
    if (typeof candidateSyllables !== 'number' || candidateSyllables <= 0) {
      return undefined
    }
    return candidateSyllables - resolvedTargetSyllables
  }
  const matchesSyllableConstraint = (candidateId: number) => {
    if (!resolvedTargetSyllables) return true
    const candidateSyllables = runtimeDb.syllables?.[candidateId] ?? 0
    if (!candidateSyllables) return true
    if (!useMultiSyllablePerfect) {
      return candidateSyllables === resolvedTargetSyllables
    }
    if (!useTwoTail) {
      return candidateSyllables === resolvedTargetSyllables
    }
    return candidateSyllables >= resolvedTargetSyllables && matchesTailKeys(candidateId)
  }

  const vowelKeys = getKeysForWordId(runtimeDb, wordId, 'vowelKeysByWordId')
  const codaKeys = getKeysForWordId(runtimeDb, wordId, 'codaKeysByWordId')
  const targetCodaKeys = codaKeys
  const targetVowelKey = selectKey(db.indexes.vowel, vowelKeys)
  const targetCodaKey = selectKey(db.indexes.coda, codaKeys)

  const targetVowel = targetVowelKey ?? ''

  if (normalizedMode === 'perfect') {
    const perfectIndex = db.indexes.perfect
    const perfectKeys = getKeysForWordId(runtimeDb, wordId, 'perfectKeysByWordId')

    const targetPerfectKey = selectKey(perfectIndex, perfectKeys)
    if (!targetPerfectKey) {
      return {
        words: [],
        debug: {
          normalizedToken: normalized,
          wordId,
          perfectKey: null,
          vowelKey: targetVowelKey ?? null,
          codaKey: targetCodaKey ?? null,
          perfectTailLenUsed: useTwoTail ? 2 : 1,
          candidatePools: { perfect: 0, near: 0 },
          poolSize: 0,
          afterModeMatchCount: 0,
          afterRareRankOrFilterCount: 0,
        },
      }
    }

    const candidates = collectWordIds(perfectIndex, [targetPerfectKey])
    const poolSize = candidates.size
    const metadata = Array.from(candidates)
      .filter((id) => id !== wordId)
      .map((id) => {
        const rawWord = db.words[id]
        const word = rawWord.toLowerCase()
        const freq = getFrequency(id)
        const syllableDelta = getSyllableDelta(id)
        const quality = classifyCandidate(rawWord)
        const codaScore = targetCodaKey ? EXACT_CODA_SCORE : 0
        const modeScore = PERFECT_MATCH_SCORE + codaScore + scorePenalties(word)
        return {
          word: rawWord,
          normalizedWord: word,
          qualityTier: quality.qualityTier,
          commonScore: quality.commonScore,
          modeScore,
          freq,
          syllableDistance: getSyllableDistance(runtimeDb, id, targetSyllables),
          isCommon: isCommonEnglishWord(word),
          commonFlag: isCommonEnglishWord(word) ? 1 : 0,
          id,
          syllableDelta,
          codaScore,
        }
      })
    const filtered = metadata
      .filter((entry) => !isTrivialInflection(normalized, entry.normalizedWord))
      .filter((entry) => matchesSyllableConstraint(entry.id))
      .filter((entry) => isBaseAllowed(entry.normalizedWord))
      .filter((entry) => shouldIncludeTier(entry.qualityTier))
      .filter((entry) => includeRareWords || showVariants || !isVariantSpelling(entry.normalizedWord, entry.commonScore))
      .filter((entry) => {
        if (!useTwoTail) return true
        const candidateKeys = runtimeDb.runtime?.perfect2KeysByWordId
          ? getKeysForWordId(runtimeDb, entry.id, 'perfect2KeysByWordId')
          : []
        return candidateKeys.some((key) => targetPerfect2Keys.includes(key))
      })

    filtered.sort((a, b) => compareEntries(a, b))
    const tierCounts = getTierCounts(filtered)
    const topCandidates = filtered.slice(0, 10).map((entry) => ({
      word: entry.word,
      tier: entry.qualityTier,
      score: entry.commonScore,
    }))
    logSuggestionDebug(context, {
      token: normalized,
      includeRare: includeRareWords,
      freqAvailable,
      totalCount: metadata.length,
      commonCount: metadata.filter((entry) => entry.isCommon).length,
      unknownCount: metadata.filter((entry) => !entry.isCommon).length,
      finalCount: filtered.length,
      entries: filtered,
    })

    return {
      words: filtered.slice(0, limit).map((entry) => entry.word),
      debug: {
        normalizedToken: normalized,
        wordId,
        perfectKey: targetPerfectKey,
        vowelKey: targetVowelKey ?? null,
        codaKey: targetCodaKey ?? null,
        perfectTailLenUsed: useTwoTail ? 2 : 1,
        candidatePools: { perfect: poolSize, near: 0 },
        poolSize,
        afterModeMatchCount: metadata.length,
        afterRareRankOrFilterCount: filtered.length,
        tierCounts: process.env.NODE_ENV !== 'production' ? tierCounts : undefined,
        topCandidates: process.env.NODE_ENV !== 'production' ? topCandidates : undefined,
      },
    }
  }

  if (normalizedMode === 'near') {
    const vowelSet = targetVowelKey ? collectWordIds(db.indexes.vowel, [targetVowelKey]) : new Set<number>()
    if (vowelSet.size === 0) {
      return {
        words: [],
        debug: {
          normalizedToken: normalized,
          wordId,
          perfectKey: null,
          vowelKey: targetVowelKey ?? null,
          codaKey: targetCodaKey ?? null,
          candidatePools: { perfect: 0, near: 0 },
          poolSize: 0,
          afterModeMatchCount: 0,
          afterRareRankOrFilterCount: 0,
          vowelPoolSize: vowelSet.size,
          codaPoolSize: 0,
          combinedUniqueCount: vowelSet.size,
          renderedCount: 0,
        },
      }
    }

    const targetPerfectKeys = getKeysForWordId(runtimeDb, wordId, 'perfectKeysByWordId')
    const metadata = Array.from(vowelSet)
      .filter((id) => id !== wordId)
      .map((id) => {
        const candidateVowelKeys = getKeysForWordId(runtimeDb, id, 'vowelKeysByWordId')
        const candidateCodaKeys = getKeysForWordId(runtimeDb, id, 'codaKeysByWordId')
        const candidatePerfectKeys = getKeysForWordId(runtimeDb, id, 'perfectKeysByWordId')
        const vowelMatches = targetVowelKey ? candidateVowelKeys.includes(targetVowel) : false
        const perfectMatch =
          targetPerfectKeys.length > 0 && candidatePerfectKeys.some((key) => targetPerfectKeys.includes(key))
        const codaScore = scoreCodaSimilarity(candidateCodaKeys, targetCodaKeys)
        const codaMatches = targetCodaKey ? codaScore >= 40 : false
        const rawWord = db.words[id]
        const word = rawWord.toLowerCase()
        const freq = getFrequency(id)
        const syllableDelta = getSyllableDelta(id)
        const quality = classifyCandidate(rawWord)
        const modeScore =
          (perfectMatch ? PERFECT_MATCH_SCORE : 0) +
          (vowelMatches ? NEAR_BASE_SCORE : 0) +
          codaScore +
          scorePenalties(word)
        return {
          word: rawWord,
          normalizedWord: word,
          qualityTier: quality.qualityTier,
          commonScore: quality.commonScore,
          modeScore,
          freq,
          syllableDistance: getSyllableDistance(runtimeDb, id, targetSyllables),
          isCommon: isCommonEnglishWord(word),
          commonFlag: isCommonEnglishWord(word) ? 1 : 0,
          id,
          vowelMatches,
          codaMatches,
          codaScore,
          syllableDelta,
        }
      })
    const filtered = metadata
      .filter((entry) => entry.vowelMatches)
      .filter((entry) => !isTrivialInflection(normalized, entry.normalizedWord))
      .filter((entry) => matchesSyllableConstraint(entry.id))
      .filter((entry) => isBaseAllowed(entry.normalizedWord))
      .filter((entry) => shouldIncludeTier(entry.qualityTier))
      .filter((entry) => includeRareWords || showVariants || !isVariantSpelling(entry.normalizedWord, entry.commonScore))

    filtered.sort((a, b) => compareEntries(a, b))
    const tierCounts = getTierCounts(filtered)
    const topCandidates = filtered.slice(0, 10).map((entry) => ({
      word: entry.word,
      tier: entry.qualityTier,
      score: entry.commonScore,
    }))
    logSuggestionDebug(context, {
      token: normalized,
      includeRare: includeRareWords,
      freqAvailable,
      totalCount: metadata.length,
      commonCount: metadata.filter((entry) => entry.isCommon).length,
      unknownCount: metadata.filter((entry) => !entry.isCommon).length,
      finalCount: filtered.length,
      entries: filtered,
    })

    return {
      words: filtered.slice(0, limit).map((entry) => entry.word),
      debug: {
        normalizedToken: normalized,
        wordId,
        perfectKey: null,
        vowelKey: targetVowelKey ?? null,
        codaKey: targetCodaKey ?? null,
        candidatePools: { perfect: 0, near: vowelSet.size },
        poolSize: vowelSet.size,
        afterModeMatchCount: metadata.filter((entry) => entry.vowelMatches).length,
        afterRareRankOrFilterCount: filtered.length,
        tierCounts: process.env.NODE_ENV !== 'production' ? tierCounts : undefined,
        topCandidates: process.env.NODE_ENV !== 'production' ? topCandidates : undefined,
        vowelPoolSize: vowelSet.size,
        codaPoolSize: 0,
        combinedUniqueCount: vowelSet.size,
        renderedCount: filtered.length,
        afterGates: { near: filtered.length },
        thresholds: { near: NEAR_BASE_SCORE },
      },
    }
  }

  return {
    words: [],
    debug: {
      normalizedToken: normalized,
      wordId,
      perfectKey: null,
      vowelKey: targetVowelKey ?? null,
      codaKey: targetCodaKey ?? null,
      candidatePools: { perfect: 0, near: 0 },
      poolSize: 0,
      afterModeMatchCount: 0,
      afterRareRankOrFilterCount: 0,
    },
  }
}

export type RhymeTargetsDebug = { caret?: RhymeTokenDebug; lineLast?: RhymeTokenDebug }

export const getRhymesForTargets = (
  db: RhymeDbV1,
  targets: { caret?: string; lineLast?: string },
  mode: Mode,
  max: number,
  context?: RhymeQueryContext,
) => {
  const results: { caret?: string[]; lineLast?: string[] } = {}
  const debug: RhymeTargetsDebug = {}

  if (targets.caret !== undefined) {
    const response = getRhymesForToken(db, targets.caret, mode, max, { ...context, debugSource: 'caret' })
    results.caret = response.words
    debug.caret = response.debug
  }

  if (targets.lineLast !== undefined) {
    const response = getRhymesForToken(db, targets.lineLast, mode, max, { ...context, debugSource: 'lineLast' })
    results.lineLast = response.words
    debug.lineLast = response.debug
  }

  return { results, debug }
}
