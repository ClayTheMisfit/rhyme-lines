import type { RhymeDbV1, RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'

export type Mode = 'perfect' | 'near' | 'slant'

export type RhymeDbRuntimeMaps = {
  perfectKeysByWordId: string[][]
  vowelKeysByWordId: string[][]
  codaKeysByWordId: string[][]
}

export type RhymeDbRuntime = RhymeDbV1 & {
  runtime?: RhymeDbRuntimeMaps
}

const PUNCTUATION_REGEX = /^[.,!?;:"()\[\]{}<>]+|[.,!?;:"()\[\]{}<>]+$/g

export const normalizeToken = (raw: string) => {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) {
    return ''
  }
  return trimmed.replace(PUNCTUATION_REGEX, '')
}

export const findWordId = (words: string[], token: string) => {
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

  return runtime[kind][wordId] ?? []
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

const sortWords = (words: string[]) => words.sort((a, b) => a.localeCompare(b))

export const getRhymesForToken = (db: RhymeDbV1, token: string, mode: Mode, max: number) => {
  const normalized = normalizeToken(token)
  if (!normalized || max <= 0) {
    return []
  }

  const runtimeDb = db as RhymeDbRuntime
  const wordId = findWordId(db.words, normalized)

  if (mode === 'perfect') {
    if (wordId === -1) {
      return []
    }
    const keys = getKeysForWordId(runtimeDb, wordId, 'perfectKeysByWordId')
    if (keys.length === 0) {
      return []
    }

    const candidates = collectWordIds(db.indexes.perfect, keys)
    candidates.delete(wordId)

    const words = Array.from(candidates).map((id) => db.words[id])
    return sortWords(words).slice(0, max)
  }

  const vowelKeys = wordId === -1 ? [] : getKeysForWordId(runtimeDb, wordId, 'vowelKeysByWordId')
  const codaKeys = wordId === -1 ? [] : getKeysForWordId(runtimeDb, wordId, 'codaKeysByWordId')

  const vowelSet = collectWordIds(db.indexes.vowel, vowelKeys)
  const codaSet = collectWordIds(db.indexes.coda, codaKeys)

  if (mode === 'near') {
    vowelSet.delete(wordId)
    codaSet.delete(wordId)

    const both: string[] = []
    const only: string[] = []

    for (const id of vowelSet) {
      const word = db.words[id]
      if (codaSet.has(id)) {
        both.push(word)
      } else {
        only.push(word)
      }
    }

    for (const id of codaSet) {
      if (!vowelSet.has(id)) {
        only.push(db.words[id])
      }
    }

    const sortedBoth = sortWords(both)
    const sortedOnly = sortWords(only)

    return [...sortedBoth, ...sortedOnly].slice(0, max)
  }

  const perfectKeys = wordId === -1 ? [] : getKeysForWordId(runtimeDb, wordId, 'perfectKeysByWordId')
  const perfectSet = collectWordIds(db.indexes.perfect, perfectKeys)

  const candidateSet = new Set<number>()
  for (const id of vowelSet) {
    candidateSet.add(id)
  }
  for (const id of codaSet) {
    candidateSet.add(id)
  }

  const fallbackSet = new Set<number>()
  if (normalized.length >= 3 && (wordId === -1 || candidateSet.size < max)) {
    const suffix = normalized.slice(-3)
    for (let index = 0; index < db.words.length && fallbackSet.size < 2000; index += 1) {
      if (db.words[index].endsWith(suffix)) {
        fallbackSet.add(index)
      }
    }
  }

  for (const id of fallbackSet) {
    candidateSet.add(id)
  }

  const scored = Array.from(candidateSet)
    .filter((id) => id !== wordId)
    .map((id) => {
      let score = 0
      if (perfectSet.has(id)) {
        score += 2
      }
      if (vowelSet.has(id)) {
        score += 1
      }
      if (codaSet.has(id)) {
        score += 1
      }
      if (fallbackSet.has(id)) {
        score += 0.5
      }
      return {
        word: db.words[id],
        score,
      }
    })

  scored.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score
    }
    return a.word.localeCompare(b.word)
  })

  return scored.slice(0, max).map((entry) => entry.word)
}

export const getRhymesForTargets = (
  db: RhymeDbV1,
  targets: { caret?: string; lineLast?: string },
  mode: Mode,
  max: number,
) => {
  const results: { caret?: string[]; lineLast?: string[] } = {}

  if (targets.caret !== undefined) {
    results.caret = getRhymesForToken(db, targets.caret, mode, max)
  }

  if (targets.lineLast !== undefined) {
    results.lineLast = getRhymesForToken(db, targets.lineLast, mode, max)
  }

  return results
}
