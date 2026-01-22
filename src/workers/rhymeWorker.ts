import type { RhymeDbV1, RhymeIndex } from '@/lib/rhyme-db/buildRhymeDb'
import { buildDbUrl } from '@/lib/rhyme-db/buildDbUrl'
import { parseRhymeDbPayload, type ParsedRhymeDb, type RhymeDbLoadStatus } from '@/lib/rhyme-db/loadRhymeDb'
import { RHYME_DB_VERSION } from '@/lib/rhyme-db/version'
import {
  getRhymesForTargets,
  normalizeToken,
  type Mode,
  type RhymeQueryContext,
  type RhymeDbRuntime,
  type RhymeDbRuntimeMaps,
  type RhymeDbRuntimeLookups,
  type RhymeTargetsDebug,
} from '@/lib/rhyme-db/queryRhymes'

type InitMsg = { type: 'init'; baseUrl: string }

type GetRhymesMsg = {
  type: 'getRhymes'
  requestId: string
  targets: { caret?: string; lineLast?: string }
  mode: Mode
  max: number
  context?: RhymeQueryContext
}

type InitOk = { type: 'init:ok'; warning?: string; status?: RhymeDbLoadStatus }

type WorkerErrorPayload = { message: string; code?: 'DB_UNAVAILABLE' }

type InitErr = { type: 'init:err'; error: WorkerErrorPayload }

type RhymesOk = {
  type: 'getRhymes:ok'
  requestId: string
  mode: string
  results: { caret?: string[]; lineLast?: string[] }
  debug?: RhymeTargetsDebug
}

type RhymesErr = { type: 'getRhymes:err'; requestId: string; error: WorkerErrorPayload }

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

const buildWordToId = (words: string[]) => {
  const map = new Map<string, number>()
  words.forEach((word, index) => {
    map.set(word.toLowerCase(), index)
  })
  return map
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

const cache = new LruCache<string, { results: { caret?: string[]; lineLast?: string[] }; debug?: RhymeTargetsDebug }>(2000)

let runtimeDb: RhymeDbRuntime | null = null
let initPromise: Promise<void> | null = null
let baseUrl: string | null = null
let initWarning: string | null = null
let loadStatus: RhymeDbLoadStatus | null = null

const LEGACY_WARNING = 'Using legacy rhyme DB (v1); rebuild v2 for best results.'

const createDbUnavailableError = (message: string, status?: number) => {
  const error = new Error(message) as Error & { code?: 'DB_UNAVAILABLE'; status?: number }
  error.code = 'DB_UNAVAILABLE'
  if (typeof status === 'number') {
    error.status = status
  }
  return error
}

const loadDb = async () => {
  if (!baseUrl) {
    throw createDbUnavailableError('Missing baseUrl for rhyme DB fetch')
  }
  initWarning = null
  const cacheKey = 'rhyme-db-cache'

  const loadFromUrl = async (dbUrl: string, expectedVersion: number, allowLegacy: boolean) => {
    let cachedDb: RhymeDbV1 | null = null
    let cachedParse: ParsedRhymeDb | null = null

    if ('caches' in self) {
      const cache = await caches.open(cacheKey)
      const cachedResponse = await cache.match(dbUrl)
      if (cachedResponse) {
        try {
          const cachedPayload = (await cachedResponse.clone().json()) as RhymeDbV1
          cachedParse = parseRhymeDbPayload(cachedPayload, { expectedVersion, allowLegacy })
          if (cachedParse.detectedVersion === expectedVersion) {
            cachedDb = cachedParse.db
          } else {
            await cache.delete(dbUrl)
          }
        } catch {
          await cache.delete(dbUrl)
        }
      }
    }

    let parseSucceeded = false
    let detectedVersion: number | null = cachedParse?.detectedVersion ?? null
    const db = cachedDb ?? (await (async () => {
      const response = await fetch(dbUrl, { cache: 'no-store' })
      if (!response.ok) {
        throw createDbUnavailableError(
          `Failed to load rhyme DB (${response.status} ${response.statusText}) from ${dbUrl}`,
          response.status
        )
      }
      const payload = (await response.json()) as RhymeDbV1
      let parsed: ParsedRhymeDb
      try {
        parsed = parseRhymeDbPayload(payload, { expectedVersion, allowLegacy })
        parseSucceeded = true
        detectedVersion = parsed.detectedVersion
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to parse rhyme DB JSON'
        throw createDbUnavailableError(
          `Loaded ${dbUrl}; JSON parsed: ${parseSucceeded}; detected v${detectedVersion ?? 'unknown'}; expected v${expectedVersion}. ${message}`
        )
      }
      if ('caches' in self) {
        const cache = await caches.open(cacheKey)
        await cache.put(dbUrl, new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } }))
      }
      return parsed.db
    })())

    return { db, parseSucceeded, detectedVersion }
  }

  const primaryUrl = buildDbUrl(baseUrl, RHYME_DB_VERSION)
  const legacyUrl = buildDbUrl(baseUrl, 1)
  let activeUrl = primaryUrl
  let fallbackReason: string | undefined
  let parseSucceeded = false
  let detectedVersion: number | null = null
  let db: RhymeDbV1

  try {
    const primaryResult = await loadFromUrl(primaryUrl, RHYME_DB_VERSION, false)
    db = primaryResult.db
    parseSucceeded = primaryResult.parseSucceeded
    detectedVersion = primaryResult.detectedVersion
    loadStatus = { loadedVersion: 2, source: 'v2-asset' }
  } catch (error) {
    const status = (error as Error & { status?: number }).status
    if (status !== 404) {
      throw error
    }
    fallbackReason = error instanceof Error ? error.message : 'Missing v2 rhyme DB'
    console.warn('[rhyme-db] v2 database missing; falling back to v1')
    activeUrl = legacyUrl
    const legacyResult = await loadFromUrl(legacyUrl, 1, true)
    db = legacyResult.db
    parseSucceeded = legacyResult.parseSucceeded
    detectedVersion = legacyResult.detectedVersion
    loadStatus = { loadedVersion: 1, source: 'v1-fallback', error: fallbackReason }
  }

  const error = validateDb(db)
  if (error) {
    throw createDbUnavailableError(
      `Loaded ${activeUrl}; JSON parsed: ${parseSucceeded}; detected v${detectedVersion ?? 'unknown'}; expected v${activeUrl === legacyUrl ? 1 : RHYME_DB_VERSION}. ${error}`
    )
  }

  if (loadStatus?.loadedVersion === 1 && process.env.NODE_ENV !== 'production') {
    initWarning = LEGACY_WARNING
  }

  const runtimeMaps: RhymeDbRuntimeMaps = {
    perfectKeysByWordId: buildKeysByWordId(db.indexes.perfect, db.words.length),
    vowelKeysByWordId: buildKeysByWordId(db.indexes.vowel, db.words.length),
    codaKeysByWordId: buildKeysByWordId(db.indexes.coda, db.words.length),
  }
  const runtimeLookups: RhymeDbRuntimeLookups = {
    wordToId: buildWordToId(db.words),
  }

  const perfect2 = (db.indexes as { perfect2?: RhymeIndex }).perfect2
  if (perfect2) {
    runtimeMaps.perfect2KeysByWordId = buildKeysByWordId(perfect2, db.words.length)
  }

  const freqAvailable = Array.isArray(db.freqByWordId) && db.freqByWordId.length === db.words.length
  runtimeDb = Object.assign(db, { runtime: runtimeMaps, runtimeLookups, freqAvailable })
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
    baseUrl = message.baseUrl
    ensureInit()
      .then(() => {
        post({ type: 'init:ok', warning: initWarning ?? undefined, status: loadStatus ?? undefined })
      })
      .catch((error: Error) => {
        const payload: WorkerErrorPayload = {
          message: error.message,
          code: (error as Error & { code?: 'DB_UNAVAILABLE' }).code,
        }
        post({ type: 'init:err', error: payload })
      })
    return
  }

  if (message.type === 'getRhymes') {
    const handleGetRhymes = async () => {
      try {
        await ensureInit()
      } catch (error) {
        const messageText = error instanceof Error ? error.message : 'Failed to initialize rhyme db'
        const payload: WorkerErrorPayload = {
          message: messageText,
          code: (error as Error & { code?: 'DB_UNAVAILABLE' }).code,
        }
        post({ type: 'getRhymes:err', requestId: message.requestId, error: payload })
        return
      }

      if (!runtimeDb) {
        post({
          type: 'getRhymes:err',
          requestId: message.requestId,
          error: { message: 'Worker not initialized' },
        })
        return
      }

      const activeDb = runtimeDb
      const caretToken = normalizeToken(message.targets.caret ?? '')
      const lineLastToken = normalizeToken(message.targets.lineLast ?? '')
      const normalizedMode = message.mode.toLowerCase() as Mode
      const desiredSyllables =
        typeof message.context?.desiredSyllables === 'number' ? message.context.desiredSyllables : 'none'
      const multiSyllable = message.context?.multiSyllable ? '1' : '0'
      const includeRareWords = message.context?.includeRareWords ?? message.context?.includeRare ?? false
      const includeRare = includeRareWords ? '1' : '0'
      const cacheKey = `${normalizedMode}|${message.max}|${desiredSyllables}|${multiSyllable}|${includeRare}|c:${caretToken}|l:${lineLastToken}`

      const cached = cache.get(cacheKey)
      if (cached) {
        post({
          type: 'getRhymes:ok',
          requestId: message.requestId,
          mode: message.mode,
          results: cached.results,
          debug: cached.debug,
        })
        return
      }

      try {
        const response = getRhymesForTargets(activeDb, message.targets, normalizedMode, message.max, message.context)
        cache.set(cacheKey, response)
        if (process.env.NODE_ENV !== 'production') {
          const wordsLength = activeDb.words.length
          const freqLength = activeDb.freqByWordId?.length ?? 0
          const freqAvailable = Array.isArray(activeDb.freqByWordId) && freqLength === wordsLength
          const caretResults = response.results.caret ?? []
          const topCaret = caretResults.slice(0, 10).map((word) => {
            const id = activeDb.runtimeLookups?.wordToId.get(word.toLowerCase())
            const freq = id !== undefined ? activeDb.freqByWordId?.[id] ?? 0 : 0
            return { word, freq }
          })
          console.debug('[rhyme-db] freq availability', {
            freqAvailable,
            wordsLength,
            freqLength,
            caret: topCaret,
          })
        }
        post({
          type: 'getRhymes:ok',
          requestId: message.requestId,
          mode: message.mode,
          results: response.results,
          debug: response.debug,
        })
      } catch (error) {
        const messageText = error instanceof Error ? error.message : 'Failed to fetch rhymes'
        const payload: WorkerErrorPayload = {
          message: messageText,
          code: (error as Error & { code?: 'DB_UNAVAILABLE' }).code,
        }
        post({ type: 'getRhymes:err', requestId: message.requestId, error: payload })
      }
    }

    void handleGetRhymes()
  }
})
