import type { RhymeDbV1, RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'
import {
  codaSimilarity,
  tailSimilarity,
  vowelSimilarity,
  type Tail,
} from '@/lib/rhyme-db/arpabetFeatures'

export type Mode = 'perfect' | 'near' | 'slant' | 'Perfect' | 'Near' | 'Slant'

export type RhymeDbRuntimeMaps = {
  wordToId: Map<string, number>
  perfectKeysByWordId: string[][]
  perfect2KeysByWordId?: string[][]
  vowelKeysByWordId: string[][]
  codaKeysByWordId: string[][]
}

export type RhymeDbRuntime = RhymeDbV1 & {
  runtime?: RhymeDbRuntimeMaps
}

export type RhymeQueryContext = {
  wordUsage?: Record<string, number>
  desiredSyllables?: number
  multiSyllable?: boolean
}

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
  const runtime = db.runtime
  if (runtime?.wordToId) {
    const directId = runtime.wordToId.get(token)
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

const getKeysForWordId = (db: RhymeDbRuntime, wordId: number, kind: keyof RhymeDbRuntimeMaps) => {
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

const getSyllableFit = (db: RhymeDbRuntime, wordId: number, desired?: number) => {
  if (typeof desired !== 'number' || Number.isNaN(desired)) {
    return 0.5
  }
  const candidateSyllables = db.syllables[wordId] ?? 0
  const diff = Math.abs(candidateSyllables - desired)
  return 1 - Math.min(1, diff / 3)
}

const sortWords = (words: string[]) => words.sort((a, b) => a.localeCompare(b))

const scoreEntry = (phoneticScore: number, freq: number, syllableFit: number) =>
  phoneticScore * 0.55 + Math.log(freq + 1) * 0.3 + syllableFit * 0.15

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
  const wordId = findWordId(runtimeDb, normalized)
  if (wordId === -1) {
    return []
  }

  const vowelKeys = getKeysForWordId(runtimeDb, wordId, 'vowelKeysByWordId')
  const codaKeys = getKeysForWordId(runtimeDb, wordId, 'codaKeysByWordId')
  const targetVowelKey = selectKey(db.indexes.vowel, vowelKeys)
  const targetCodaKey = selectKey(db.indexes.coda, codaKeys)

  const targetVowel = targetVowelKey ?? ''
  const targetCoda = splitCodaKey(targetCodaKey ?? '')

  const usage = context.wordUsage ?? {}

  if (normalizedMode === 'perfect') {
    const perfectIndex = (db.indexes as { perfect2?: RhymeIndex }).perfect2 && context.multiSyllable
      ? (db.indexes as { perfect2: RhymeIndex }).perfect2
      : db.indexes.perfect
    const perfectKeys = context.multiSyllable && runtimeDb.runtime?.perfect2KeysByWordId
      ? getKeysForWordId(runtimeDb, wordId, 'perfect2KeysByWordId')
      : getKeysForWordId(runtimeDb, wordId, 'perfectKeysByWordId')

    const targetPerfectKey = selectKey(perfectIndex, perfectKeys)
    if (!targetPerfectKey) {
      return []
    }

    const candidates = collectWordIds(perfectIndex, [targetPerfectKey])
    const scored = Array.from(candidates)
      .filter((id) => id !== wordId)
      .map((id) => {
        const word = db.words[id].toLowerCase()
        const syllableFit = getSyllableFit(runtimeDb, id, context.desiredSyllables)
        return {
          word,
          score: scoreEntry(1, usage[word] ?? 0, syllableFit),
        }
      })
      .filter((entry) => !isTrivialInflection(normalized, entry.word))

    scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      return a.word.localeCompare(b.word)
    })

    return scored.slice(0, max).map((entry) => entry.word)
  }

  if (!targetVowelKey || !targetCodaKey) {
    return []
  }

  const vowelSet = collectWordIds(db.indexes.vowel, [targetVowelKey])
  const codaSet = collectWordIds(db.indexes.coda, [targetCodaKey])
  const candidateSet = new Set<number>()

  for (const id of vowelSet) candidateSet.add(id)
  for (const id of codaSet) candidateSet.add(id)

  if (normalizedMode === 'near') {
    const scored = Array.from(candidateSet)
      .filter((id) => id !== wordId)
      .map((id) => {
        const candidateVowelKeys = getKeysForWordId(runtimeDb, id, 'vowelKeysByWordId')
        const candidateCodaKeys = getKeysForWordId(runtimeDb, id, 'codaKeysByWordId')
        const bestVowelKey = getBestVowelKey(candidateVowelKeys, targetVowel)
        const bestCodaKey = getBestCodaKey(candidateCodaKeys, targetCoda)
        const vowelScore = bestVowelKey ? getNearVowelScore(targetVowel, bestVowelKey) : 0
        const codaScore = bestCodaKey ? codaSimilarity(targetCoda, splitCodaKey(bestCodaKey)) : 0
        const phoneticScore = 0.6 * vowelScore + 0.4 * codaScore
        const word = db.words[id].toLowerCase()
        const syllableFit = getSyllableFit(runtimeDb, id, context.desiredSyllables)
        return {
          word,
          score: scoreEntry(phoneticScore, usage[word] ?? 0, syllableFit),
          phoneticScore,
        }
      })
      .filter((entry) => entry.phoneticScore > 0 && !isTrivialInflection(normalized, entry.word))

    scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      return a.word.localeCompare(b.word)
    })

    return scored.slice(0, max).map((entry) => entry.word)
  }

  const candidateList = Array.from(candidateSet)
    .filter((id) => id !== wordId)
    .map((id) => db.words[id].toLowerCase())
  const trimmedCandidates = candidateList
    .map((word) => ({
      word,
      freq: usage[word] ?? 0,
    }))
    .sort((a, b) => {
      if (a.freq !== b.freq) return b.freq - a.freq
      return a.word.localeCompare(b.word)
    })
    .slice(0, 2000)
    .map((entry) => entry.word)

  const targetTail = buildTail(targetVowelKey, targetCodaKey)

  const scored = trimmedCandidates
    .map((word) => {
      const id = findWordId(runtimeDb, word)
      if (id === -1) return null
      const candidateVowelKeys = getKeysForWordId(runtimeDb, id, 'vowelKeysByWordId')
      const candidateCodaKeys = getKeysForWordId(runtimeDb, id, 'codaKeysByWordId')
      const bestVowelKey = getBestVowelKey(candidateVowelKeys, targetVowel)
      const bestCodaKey = getBestCodaKey(candidateCodaKeys, targetCoda)
      if (!bestVowelKey || !bestCodaKey) return null
      const candidateTail = buildTail(bestVowelKey, bestCodaKey)
      const phoneticScore = tailSimilarity(targetTail, candidateTail)
      if (phoneticScore < 0.62) return null
      const syllableFit = getSyllableFit(runtimeDb, id, context.desiredSyllables)
      return {
        word,
        score: scoreEntry(phoneticScore, usage[word] ?? 0, syllableFit),
        phoneticScore,
      }
    })
    .filter((entry): entry is { word: string; score: number; phoneticScore: number } => Boolean(entry))
    .filter((entry) => !isTrivialInflection(normalized, entry.word))

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return a.word.localeCompare(b.word)
  })

  return scored.slice(0, max).map((entry) => entry.word)
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
    results.caret = getRhymesForToken(db, targets.caret, mode, max, context)
  }

  if (targets.lineLast !== undefined) {
    results.lineLast = getRhymesForToken(db, targets.lineLast, mode, max, context)
  }

  return results
}
