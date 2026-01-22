import type { RhymeDbV1, RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'
import {
  codaSimilarity,
  vowelSimilarity,
} from '@/lib/rhyme-db/arpabetFeatures'
import { isCommonEnglishWord } from '@/lib/rhyme-db/commonEnglish'
import { normalizeToken } from '@/lib/rhyme-db/normalizeToken'

export { normalizeToken }

export type Mode = 'perfect' | 'near' | 'slant' | 'Perfect' | 'Near' | 'Slant'

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
  debugSource?: 'caret' | 'lineLast'
}

const MAX_RESULTS = 200
const MAX_CANDIDATES = 2000

const normalizeMode = (mode: Mode) => mode.toLowerCase() as 'perfect' | 'near' | 'slant'

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

export type RhymeTokenDebug = {
  normalizedToken: string
  wordId: number | null
  perfectKey?: string | null
  vowelKey?: string | null
  codaKey?: string | null
  candidatePools: { perfect: number; near: number; slant: number }
  afterGates?: { near: number; slant: number }
  thresholds?: { near: number; slant: number }
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

const compareEntries = (includeRareWords: boolean, a: RankedEntry, b: RankedEntry) => {
  if (typeof a.syllableDelta === 'number' && typeof b.syllableDelta === 'number' && a.syllableDelta !== b.syllableDelta) {
    return a.syllableDelta - b.syllableDelta
  }
  if (typeof a.codaScore === 'number' && typeof b.codaScore === 'number' && a.codaScore !== b.codaScore) {
    return b.codaScore - a.codaScore
  }
  if (a.modeScore !== b.modeScore) return b.modeScore - a.modeScore
  if (includeRareWords && a.commonFlag !== b.commonFlag) return b.commonFlag - a.commonFlag
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

type RankedEntry = {
  word: string
  normalizedWord: string
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
        candidatePools: { perfect: 0, near: 0, slant: 0 },
      },
    }
  }

  const runtimeDb = db as RhymeDbRuntime
  const normalizedMode = normalizeMode(mode)
  const freqAvailable =
    Array.isArray(runtimeDb.freqByWordId) && runtimeDb.freqByWordId.length === runtimeDb.words.length
  const includeRareWords = context.includeRareWords ?? context.includeRare ?? false
  const wordUsage = context.wordUsage ?? {}
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

  const isProperNoun = (rawWord?: string) => Boolean(rawWord && /^[A-Z]/.test(rawWord))
  const isStrictAllowed = (word: string, rawWord?: string) => {
    const normalizedWord = word.toLowerCase()
    if (!shouldAllowWord(normalizedWord)) return false
    if (includeRareWords) return true
    if (!/^[a-z]+$/.test(normalizedWord)) return false
    if (isProperNoun(rawWord)) return false
    if (!/[aeiouy]/.test(normalizedWord)) return false
    if (isCommonEnglishWord(normalizedWord)) return true
    return Boolean(wordUsage[normalizedWord])
  }

  const wordId = findWordId(runtimeDb, normalized)
  if (wordId === -1) {
    if (normalizedMode !== 'slant') {
      return {
        words: [],
        debug: {
          normalizedToken: normalized,
          wordId: null,
          perfectKey: null,
          vowelKey: null,
          codaKey: null,
          candidatePools: { perfect: 0, near: 0, slant: 0 },
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
          candidatePools: { perfect: 0, near: 0, slant: 0 },
        },
      }
    }
    const suffix = normalized.slice(-suffixLength)
    const metadata = db.words
      .map((word, id) => {
        const candidate = word.toLowerCase()
        if (!candidate.endsWith(suffix)) return null
        const freq = getFrequency(id)
        const commonFlag = isCommonEnglishWord(candidate) ? 1 : 0
        return {
          word,
          normalizedWord: candidate,
          modeScore: 0,
          freq,
          syllableDistance: 0,
          isCommon: commonFlag === 1,
          commonFlag,
        }
      })
      .filter((entry): entry is RankedEntry => Boolean(entry))
    const filtered = metadata.filter((entry) => isStrictAllowed(entry.normalizedWord, entry.word))
    filtered.sort((a, b) => compareEntries(includeRareWords, a, b))
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
        candidatePools: { perfect: 0, near: 0, slant: metadata.length },
      },
    }
  }

  const targetSyllables = (runtimeDb.syllables?.[wordId] ?? 0) || context.desiredSyllables
  const resolvedTargetSyllables =
    typeof targetSyllables === 'number' && targetSyllables > 0 ? targetSyllables : undefined
  const useMultiSyllablePerfect = normalizedMode === 'perfect' && context.multiSyllable
  const tailKeyKind: KeysByWordIdKind =
    useMultiSyllablePerfect &&
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
    return candidateSyllables >= resolvedTargetSyllables && matchesTailKeys(candidateId)
  }

  const vowelKeys = getKeysForWordId(runtimeDb, wordId, 'vowelKeysByWordId')
  const codaKeys = getKeysForWordId(runtimeDb, wordId, 'codaKeysByWordId')
  const targetCodaKeys = codaKeys
  const targetVowelKey = selectKey(db.indexes.vowel, vowelKeys)
  const targetCodaKey = selectKey(db.indexes.coda, codaKeys)

  const targetVowel = targetVowelKey ?? ''
  const targetCoda = splitCodaKey(targetCodaKey ?? '')

  if (normalizedMode === 'perfect') {
    const indexes = db.indexes as RhymeDbV1['indexes'] & { perfect2?: RhymeIndex }
    const perfect2Index = 'perfect2' in indexes ? indexes.perfect2 : undefined
    const perfectIndex = perfect2Index && useMultiSyllablePerfect ? perfect2Index : db.indexes.perfect
    const perfectKeys = useMultiSyllablePerfect && runtimeDb.runtime?.perfect2KeysByWordId
      ? getKeysForWordId(runtimeDb, wordId, 'perfect2KeysByWordId')
      : getKeysForWordId(runtimeDb, wordId, 'perfectKeysByWordId')

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
          candidatePools: { perfect: 0, near: 0, slant: 0 },
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
        return {
          word: rawWord,
          normalizedWord: word,
          modeScore: 1,
          freq,
          syllableDistance: getSyllableDistance(runtimeDb, id, targetSyllables),
          isCommon: isCommonEnglishWord(word),
          commonFlag: isCommonEnglishWord(word) ? 1 : 0,
          id,
          syllableDelta,
          codaScore: 1,
        }
      })
    const filtered = metadata
      .filter((entry) => !isTrivialInflection(normalized, entry.normalizedWord))
      .filter((entry) => matchesSyllableConstraint(entry.id))
      .filter((entry) => isStrictAllowed(entry.normalizedWord, entry.word))

    filtered.sort((a, b) => compareEntries(includeRareWords, a, b))
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
        candidatePools: { perfect: poolSize, near: 0, slant: 0 },
      },
    }
  }

  if (!targetVowelKey) {
    return {
      words: [],
      debug: {
        normalizedToken: normalized,
        wordId,
        perfectKey: null,
        vowelKey: null,
        codaKey: targetCodaKey ?? null,
        candidatePools: { perfect: 0, near: 0, slant: 0 },
      },
    }
  }

  const vowelSet = collectWordIds(db.indexes.vowel, [targetVowelKey])
  const candidateSet = new Set<number>(vowelSet)

  if (normalizedMode === 'near') {
    const metadata = Array.from(candidateSet)
      .filter((id) => id !== wordId)
      .map((id) => {
        const candidateVowelKeys = getKeysForWordId(runtimeDb, id, 'vowelKeysByWordId')
        const candidateCodaKeys = getKeysForWordId(runtimeDb, id, 'codaKeysByWordId')
        const vowelMatches = candidateVowelKeys.includes(targetVowel)
        const codaScore = maxCodaSimilarity(candidateCodaKeys, targetCodaKeys)
        const modeScore = codaScore
        const rawWord = db.words[id]
        const word = rawWord.toLowerCase()
        const freq = getFrequency(id)
        const syllableDelta = getSyllableDelta(id)
        return {
          word: rawWord,
          normalizedWord: word,
          modeScore,
          freq,
          syllableDistance: getSyllableDistance(runtimeDb, id, targetSyllables),
          isCommon: isCommonEnglishWord(word),
          commonFlag: isCommonEnglishWord(word) ? 1 : 0,
          id,
          vowelMatches,
          codaScore,
          syllableDelta,
        }
      })
    const filtered = metadata
      .filter((entry) => entry.vowelMatches)
      .filter((entry) => entry.codaScore >= 0.65)
      .filter((entry) => !isTrivialInflection(normalized, entry.normalizedWord))
      .filter((entry) => matchesSyllableConstraint(entry.id))
      .filter((entry) => isStrictAllowed(entry.normalizedWord, entry.word))

    filtered.sort((a, b) => compareEntries(includeRareWords, a, b))
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
        vowelKey: targetVowelKey,
        codaKey: targetCodaKey ?? null,
        candidatePools: { perfect: 0, near: candidateSet.size, slant: 0 },
        afterGates: { near: filtered.length, slant: 0 },
        thresholds: { near: 0.65, slant: 0.4 },
      },
    }
  }

  const candidateList = Array.from(candidateSet)
    .filter((id) => id !== wordId)
    .map((id) => {
      const rawWord = db.words[id]
      const word = rawWord.toLowerCase()
      const freq = getFrequency(id)
      return { id, word: rawWord, normalizedWord: word, freq, isCommon: isCommonEnglishWord(word) }
    })
    .slice(0, MAX_CANDIDATES)

  const metadata = candidateList
    .map((candidate): RankedMeta | null => {
      const id = candidate.id
      const candidateVowelKeys = getKeysForWordId(runtimeDb, id, 'vowelKeysByWordId')
      const candidateCodaKeys = getKeysForWordId(runtimeDb, id, 'codaKeysByWordId')
      const vowelMatches = candidateVowelKeys.includes(targetVowel)
      const codaScore = maxCodaSimilarity(candidateCodaKeys, targetCodaKeys)
      const syllableDelta = getSyllableDelta(id)
      return {
        word: candidate.word,
        normalizedWord: candidate.normalizedWord,
        modeScore: codaScore,
        freq: candidate.freq,
        syllableDistance: getSyllableDistance(runtimeDb, id, targetSyllables),
        isCommon: candidate.isCommon,
        commonFlag: isCommonEnglishWord(candidate.normalizedWord) ? 1 : 0,
        id,
        vowelMatches,
        codaScore,
        syllableDelta,
      }
    })
    .filter(isNonNullable)
  const metadataTypeCheck: RankedMeta[] = metadata
  const filtered = metadata
    .filter((entry) => entry.vowelMatches)
    .filter((entry) => entry.codaScore >= 0.4)
    .filter((entry) => !isTrivialInflection(normalized, entry.normalizedWord))
    .filter((entry) => matchesSyllableConstraint(entry.id))
    .filter((entry) => isStrictAllowed(entry.normalizedWord, entry.word))

  filtered.sort((a, b) => compareEntries(includeRareWords, a, b))
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
      vowelKey: targetVowelKey,
      codaKey: targetCodaKey ?? null,
      candidatePools: { perfect: 0, near: 0, slant: candidateSet.size },
      afterGates: { near: 0, slant: filtered.length },
      thresholds: { near: 0.65, slant: 0.4 },
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
