import type { RhymeDbV1, RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'
import type { RhymeDbRuntimeMaps, RhymeDbRuntimeLookups } from '@/lib/rhyme-db/queryRhymes'

export const buildKeysByWordId = (index: RhymeIndex, wordCount: number) => {
  const keysByWordId = Array.from({ length: wordCount }, () => [] as string[])

  index.keys.forEach((key, keyIndex) => {
    const start = index.offsets[keyIndex]
    const end = index.offsets[keyIndex + 1]
    for (let postingIndex = start; postingIndex < end; postingIndex += 1) {
      const wordId = index.wordIds[postingIndex]
      if (wordId !== undefined) {
        keysByWordId[wordId].push(key)
      }
    }
  })

  return keysByWordId
}

export const buildWordToId = (words: string[]) => {
  const map = new Map<string, number>()
  words.forEach((word, index) => {
    map.set(word.toLowerCase(), index)
  })
  return map
}

export const buildRuntimeMaps = (db: RhymeDbV1) => {
  const runtimeMaps: RhymeDbRuntimeMaps = {
    perfectKeysByWordId: buildKeysByWordId(db.indexes.perfect, db.words.length),
    vowelKeysByWordId: buildKeysByWordId(db.indexes.vowel, db.words.length),
    codaKeysByWordId: buildKeysByWordId(db.indexes.coda, db.words.length),
  }

  if (db.indexes.perfect2) {
    runtimeMaps.perfect2KeysByWordId = buildKeysByWordId(db.indexes.perfect2, db.words.length)
  }

  const runtimeLookups: RhymeDbRuntimeLookups = {
    wordToId: buildWordToId(db.words),
  }

  return { runtimeMaps, runtimeLookups }
}
