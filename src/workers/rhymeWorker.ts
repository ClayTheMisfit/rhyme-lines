import type { RhymeDbV1, RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'
import {
  getRhymesForTargets,
  normalizeToken,
  type Mode,
  type RhymeDbRuntime,
  type RhymeDbRuntimeMaps,
} from '@/lib/rhyme-db/queryRhymes'

type InitMsg = { type: 'init' }

type GetRhymesMsg = {
  type: 'getRhymes'
  requestId: string
  targets: { caret?: string; lineLast?: string }
  mode: Mode
  max: number
}

type InitOk = { type: 'init:ok' }

type InitErr = { type: 'init:err'; error: string }

type RhymesOk = {
  type: 'getRhymes:ok'
  requestId: string
  mode: string
  results: { caret?: string[]; lineLast?: string[] }
}

type RhymesErr = { type: 'getRhymes:err'; requestId: string; error: string }

type IncomingMessage = InitMsg | GetRhymesMsg

type OutgoingMessage = InitOk | InitErr | RhymesOk | RhymesErr

class LruCache<K, V> {
  private map = new Map<K, V>()

  constructor(private maxEntries = 2000) {}

  get(key: K) {
    if (!this.map.has(key)) {
      return undefined
    }
    const value = this.map.get(key)
    if (value !== undefined) {
      this.map.delete(key)
      this.map.set(key, value)
    }
    return value
  }

  set(key: K, value: V) {
    if (this.map.has(key)) {
      this.map.delete(key)
    }
    this.map.set(key, value)
    if (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey)
      }
    }
  }
}

const buildKeysByWordId = (index: RhymeIndex, wordCount: number) => {
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

const validateDb = (db: RhymeDbV1) => {
  if (!db.words || !db.indexes) {
    return 'Missing words or indexes'
  }
  if (!db.indexes.perfect || !db.indexes.vowel || !db.indexes.coda) {
    return 'Missing indexes'
  }
  return null
}

const cache = new LruCache<string, { caret?: string[]; lineLast?: string[] }>(2000)

let runtimeDb: RhymeDbRuntime | null = null
let initPromise: Promise<void> | null = null

const loadDb = async () => {
  const response = await fetch('/rhyme-db/rhyme-db.v1.json')
  if (!response.ok) {
    throw new Error(`Failed to load rhyme db: ${response.status}`)
  }
  const db = (await response.json()) as RhymeDbV1
  const error = validateDb(db)
  if (error) {
    throw new Error(error)
  }

  const runtimeMaps: RhymeDbRuntimeMaps = {
    perfectKeysByWordId: buildKeysByWordId(db.indexes.perfect, db.words.length),
    vowelKeysByWordId: buildKeysByWordId(db.indexes.vowel, db.words.length),
    codaKeysByWordId: buildKeysByWordId(db.indexes.coda, db.words.length),
  }

  runtimeDb = Object.assign(db, { runtime: runtimeMaps })
}

const ensureInit = async () => {
  if (!initPromise) {
    initPromise = loadDb()
  }
  return initPromise
}

const post = (message: OutgoingMessage) => {
  self.postMessage(message)
}

self.addEventListener('message', (event: MessageEvent<IncomingMessage>) => {
  const message = event.data
  if (message.type === 'init') {
    ensureInit()
      .then(() => {
        post({ type: 'init:ok' })
      })
      .catch((error: Error) => {
        post({ type: 'init:err', error: error.message })
      })
    return
  }

  if (message.type === 'getRhymes') {
    if (!runtimeDb) {
      post({ type: 'getRhymes:err', requestId: message.requestId, error: 'Worker not initialized' })
      return
    }

    const caretToken = normalizeToken(message.targets.caret ?? '')
    const lineLastToken = normalizeToken(message.targets.lineLast ?? '')
    const cacheKey = `${message.mode}|${message.max}|c:${caretToken}|l:${lineLastToken}`

    const cached = cache.get(cacheKey)
    if (cached) {
      post({
        type: 'getRhymes:ok',
        requestId: message.requestId,
        mode: message.mode,
        results: cached,
      })
      return
    }

    try {
      const results = getRhymesForTargets(runtimeDb, message.targets, message.mode, message.max)
      cache.set(cacheKey, results)
      post({
        type: 'getRhymes:ok',
        requestId: message.requestId,
        mode: message.mode,
        results,
      })
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Failed to fetch rhymes'
      post({ type: 'getRhymes:err', requestId: message.requestId, error: messageText })
    }
  }
})
