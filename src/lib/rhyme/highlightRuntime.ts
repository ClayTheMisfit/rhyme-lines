import type { RhymeDbV1, RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'
import type { RhymeDbRuntimeLookups, RhymeDbRuntimeMaps } from '@/lib/rhyme-db/queryRhymes'
import { buildRuntimeMaps } from '@/lib/rhyme-db/runtimeMaps'

export type RhymeHighlightRuntime = {
  runtimeMaps: RhymeDbRuntimeMaps
  runtimeLookups: RhymeDbRuntimeLookups
  perfectIndex: RhymeIndex
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

export const buildHighlightRuntime = (db: RhymeDbV1): RhymeHighlightRuntime => {
  const { runtimeMaps, runtimeLookups } = buildRuntimeMaps(db)
  return {
    runtimeMaps,
    runtimeLookups,
    perfectIndex: db.indexes.perfect,
  }
}

export const getPerfectKeyForWord = (normalized: string, runtime: RhymeHighlightRuntime): string | null => {
  const wordId = runtime.runtimeLookups.wordToId.get(normalized)
  if (wordId === undefined) return null
  const keys = runtime.runtimeMaps.perfectKeysByWordId[wordId] ?? []
  return selectKey(runtime.perfectIndex, keys)
}
