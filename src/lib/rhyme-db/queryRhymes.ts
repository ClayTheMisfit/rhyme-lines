import type { RhymeDbV1, RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'
import {
  codaSimilarity,
  tailSimilarity,
  vowelSimilarity,
  type Tail,
} from '@/lib/rhyme-db/arpabetFeatures'
import { isCommonEnglishWord } from '@/lib/rhyme-db/commonEnglish'

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

const PUNCTUATION_REGEX = /^[.,!?;:"()\[\]{}<>]+|[.,!?;:"()\[\]{}<>]+$/g

export const normalizeToken = (raw: string) => {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) {
    return ''
  }
  return trimmed.replace(PUNCTUATION_REGEX, '')
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

const buildTail = (vowelKey: string, codaKey: string) => {
  const coda = splitCodaKey(codaKey)
  return {
    vowel: vowelKey,
    coda,
    lastConsonants: coda.slice(-3),
  } satisfies Tail
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
  if (a.modeScore !== b.modeScore) return b.modeScore - a.modeScore
  if (includeRareWords && a.commonFlag !== b.commonFlag) return b.commonFlag - a.commonFlag
  if (a.freq !== b.freq) return b.freq - a.freq
  if (a.syllableDistance !== b.syllableDistance) return a.syllableDistance - b.syllableDistance
  return a.word.localeCompare(b.word)
}

type RankedEntry = {
  word: string
  modeScore: number
  freq: number
  syllableDistance: number
  isCommon: boolean
  commonFlag: number
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
) => {
  const normalized = normalizeToken(token)
  if (!normalized || max <= 0) {
    return []
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

  const isStrictAllowed = (word: string) => {
    if (includeRareWords) return true
    if (word.includes("'")) return false
    if (word.length < 2) return false
    if (!/[aeiouy]/.test(word)) return false
    if (isCommonEnglishWord(word)) return true
    return Boolean(wordUsage[word])
  }

  const wordId = findWordId(runtimeDb, normalized)
  if (wordId === -1) {
    if (normalizedMode !== 'slant') {
      return []
    }
    const suffixLength = Math.min(3, normalized.length)
    if (suffixLength < 2) {
      return []
    }
    const suffix = normalized.slice(-suffixLength)
    const metadata = db.words
      .map((word, id) => {
        const candidate = word.toLowerCase()
        if (!candidate.endsWith(suffix)) return null
        const freq = getFrequency(id)
        const commonFlag = isCommonEnglishWord(candidate) ? 1 : 0
        return {
          word: candidate,
          modeScore: 0,
          freq,
          syllableDistance: 0,
          isCommon: commonFlag === 1,
          commonFlag,
        }
      })
      .filter((entry): entry is RankedEntry => Boolean(entry))
    const filtered = metadata.filter((entry) => isStrictAllowed(entry.word))
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
    return filtered.slice(0, limit).map((entry) => entry.word)
  }

  const targetSyllables = (runtimeDb.syllables?.[wordId] ?? 0) || context.desiredSyllables

  const vowelKeys = getKeysForWordId(runtimeDb, wordId, 'vowelKeysByWordId')
  const codaKeys = getKeysForWordId(runtimeDb, wordId, 'codaKeysByWordId')
  const targetVowelKey = selectKey(db.indexes.vowel, vowelKeys)
  const targetCodaKey = selectKey(db.indexes.coda, codaKeys)

  const targetVowel = targetVowelKey ?? ''
  const targetCoda = splitCodaKey(targetCodaKey ?? '')

  if (normalizedMode === 'perfect') {
    const indexes = db.indexes as RhymeDbV1['indexes'] & { perfect2?: RhymeIndex }
    const perfect2Index = 'perfect2' in indexes ? indexes.perfect2 : undefined
    const perfectIndex = perfect2Index && context.multiSyllable ? perfect2Index : db.indexes.perfect
    const perfectKeys = context.multiSyllable && runtimeDb.runtime?.perfect2KeysByWordId
      ? getKeysForWordId(runtimeDb, wordId, 'perfect2KeysByWordId')
      : getKeysForWordId(runtimeDb, wordId, 'perfectKeysByWordId')

    const targetPerfectKey = selectKey(perfectIndex, perfectKeys)
    if (!targetPerfectKey) {
      return []
    }

    const candidates = collectWordIds(perfectIndex, [targetPerfectKey])
    const metadata = Array.from(candidates)
      .filter((id) => id !== wordId)
      .map((id) => {
        const word = db.words[id].toLowerCase()
        const freq = getFrequency(id)
        return {
          word,
          modeScore: 1,
          freq,
          syllableDistance: getSyllableDistance(runtimeDb, id, targetSyllables),
          isCommon: isCommonEnglishWord(word),
          commonFlag: isCommonEnglishWord(word) ? 1 : 0,
        }
      })
    const filtered = metadata.filter((entry) => !isTrivialInflection(normalized, entry.word))
      .filter((entry) => isStrictAllowed(entry.word))

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

    return filtered.slice(0, limit).map((entry) => entry.word)
  }

  if (!targetVowelKey) {
    return []
  }

  const vowelSet = collectWordIds(db.indexes.vowel, [targetVowelKey])
  const codaSet = targetCodaKey ? collectWordIds(db.indexes.coda, [targetCodaKey]) : []
  const candidateSet = new Set<number>()

  for (const id of vowelSet) candidateSet.add(id)
  for (const id of codaSet) candidateSet.add(id)

  if (normalizedMode === 'near') {
    const metadata = Array.from(candidateSet)
      .filter((id) => id !== wordId)
      .map((id) => {
        const candidateVowelKeys = getKeysForWordId(runtimeDb, id, 'vowelKeysByWordId')
        const candidateCodaKeys = getKeysForWordId(runtimeDb, id, 'codaKeysByWordId')
        const bestVowelKey = getBestVowelKey(candidateVowelKeys, targetVowel)
        const bestCodaKey = targetCodaKey ? getBestCodaKey(candidateCodaKeys, targetCoda) : ''
        const vowelScore = bestVowelKey ? getNearVowelScore(targetVowel, bestVowelKey) : 0
        const codaScore = targetCodaKey && bestCodaKey
          ? codaSimilarity(targetCoda, splitCodaKey(bestCodaKey))
          : 0
        const modeScore = 0.6 * vowelScore + 0.4 * codaScore
        const word = db.words[id].toLowerCase()
        const freq = getFrequency(id)
        return {
          word,
          modeScore,
          freq,
          syllableDistance: getSyllableDistance(runtimeDb, id, targetSyllables),
          isCommon: isCommonEnglishWord(word),
          commonFlag: isCommonEnglishWord(word) ? 1 : 0,
        }
      })
    const filtered = metadata
      .filter((entry) => entry.modeScore > 0)
      .filter((entry) => !isTrivialInflection(normalized, entry.word))
      .filter((entry) => isStrictAllowed(entry.word))

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

    return filtered.slice(0, limit).map((entry) => entry.word)
  }

  const candidateList = Array.from(candidateSet)
    .filter((id) => id !== wordId)
    .map((id) => {
      const word = db.words[id].toLowerCase()
      const freq = getFrequency(id)
      return { id, word, freq, isCommon: isCommonEnglishWord(word) }
    })
    .slice(0, MAX_CANDIDATES)

  const targetTail = buildTail(targetVowelKey, targetCodaKey ?? '')

  const metadata = candidateList
    .map((candidate) => {
      const id = candidate.id
      const candidateVowelKeys = getKeysForWordId(runtimeDb, id, 'vowelKeysByWordId')
      const candidateCodaKeys = getKeysForWordId(runtimeDb, id, 'codaKeysByWordId')
      const bestVowelKey = getBestVowelKey(candidateVowelKeys, targetVowel)
      const bestCodaKey = targetCodaKey ? getBestCodaKey(candidateCodaKeys, targetCoda) : ''
      if (!bestVowelKey || (targetCodaKey && !bestCodaKey)) return null
      const candidateTail = buildTail(bestVowelKey, bestCodaKey ?? '')
      const modeScore = tailSimilarity(targetTail, candidateTail)
      return {
        word: candidate.word,
        modeScore,
        freq: candidate.freq,
        syllableDistance: getSyllableDistance(runtimeDb, id, targetSyllables),
        isCommon: candidate.isCommon,
        commonFlag: isCommonEnglishWord(candidate.word) ? 1 : 0,
      }
    })
    .filter((entry): entry is RankedEntry => Boolean(entry))
  const filtered = metadata
    .filter((entry) => entry.modeScore >= 0.62)
    .filter((entry) => !isTrivialInflection(normalized, entry.word))
    .filter((entry) => isStrictAllowed(entry.word))

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

  return filtered.slice(0, limit).map((entry) => entry.word)
}

export const getRhymesForTargets = (
  db: RhymeDbV1,
  targets: { caret?: string; lineLast?: string },
  mode: Mode,
  max: number,
  context?: RhymeQueryContext,
) => {
  const results: { caret?: string[]; lineLast?: string[] } = {}

  if (targets.caret !== undefined) {
    results.caret = getRhymesForToken(db, targets.caret, mode, max, { ...context, debugSource: 'caret' })
  }

  if (targets.lineLast !== undefined) {
    results.lineLast = getRhymesForToken(db, targets.lineLast, mode, max, { ...context, debugSource: 'lineLast' })
  }

  return results
}
