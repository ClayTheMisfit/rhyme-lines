import type { RhymeWorkerFilters, RhymeWorkerRequest, RhymeWorkerResponse, RhymeWorkerResult } from '@/lib/rhyme/workerTypes'

type DictShard = Record<string, string[]>

type ConsonantFeatures = {
  place: 'bilabial' | 'labiodental' | 'dental' | 'alveolar' | 'postalveolar' | 'palatal' | 'velar' | 'glottal'
  manner: 'stop' | 'fricative' | 'affricate' | 'nasal' | 'liquid' | 'glide'
  voiced: boolean
}

type ScoredCandidate = {
  word: string
  score: number
}

const VOWELS = new Set([
  'AA',
  'AE',
  'AH',
  'AO',
  'AW',
  'AY',
  'EH',
  'ER',
  'EY',
  'IH',
  'IY',
  'OW',
  'OY',
  'UH',
  'UW',
])

const VOWEL_FAMILY: Record<string, string> = {
  AA: 'open-back',
  AO: 'open-back',
  AH: 'mid-central',
  AE: 'front',
  EH: 'front',
  IH: 'front',
  IY: 'front',
  EY: 'front',
  AY: 'front',
  ER: 'central',
  OW: 'back',
  OY: 'back',
  UH: 'back',
  UW: 'back',
  AW: 'back',
}

const CONSONANT_FEATURES: Record<string, ConsonantFeatures> = {
  B: { place: 'bilabial', manner: 'stop', voiced: true },
  P: { place: 'bilabial', manner: 'stop', voiced: false },
  M: { place: 'bilabial', manner: 'nasal', voiced: true },
  F: { place: 'labiodental', manner: 'fricative', voiced: false },
  V: { place: 'labiodental', manner: 'fricative', voiced: true },
  TH: { place: 'dental', manner: 'fricative', voiced: false },
  DH: { place: 'dental', manner: 'fricative', voiced: true },
  T: { place: 'alveolar', manner: 'stop', voiced: false },
  D: { place: 'alveolar', manner: 'stop', voiced: true },
  S: { place: 'alveolar', manner: 'fricative', voiced: false },
  Z: { place: 'alveolar', manner: 'fricative', voiced: true },
  N: { place: 'alveolar', manner: 'nasal', voiced: true },
  L: { place: 'alveolar', manner: 'liquid', voiced: true },
  R: { place: 'alveolar', manner: 'liquid', voiced: true },
  SH: { place: 'postalveolar', manner: 'fricative', voiced: false },
  ZH: { place: 'postalveolar', manner: 'fricative', voiced: true },
  CH: { place: 'postalveolar', manner: 'affricate', voiced: false },
  JH: { place: 'postalveolar', manner: 'affricate', voiced: true },
  Y: { place: 'palatal', manner: 'glide', voiced: true },
  K: { place: 'velar', manner: 'stop', voiced: false },
  G: { place: 'velar', manner: 'stop', voiced: true },
  NG: { place: 'velar', manner: 'nasal', voiced: true },
  W: { place: 'velar', manner: 'glide', voiced: true },
  HH: { place: 'glottal', manner: 'fricative', voiced: false },
}

const MAX_RESULTS = 50
const MEMORY_CACHE_LIMIT = 400
const NEAR_THRESHOLD = 0.6
const SLANT_THRESHOLD = 0.4

const shardCache = new Map<string, DictShard>()
const memoryCache = new Map<string, RhymeWorkerResult>()

const DB_NAME = 'rhyme-lines'
const STORE_NAME = 'rhyme-worker-cache'

const hydratePromise = hydratePersistentCache()

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, '')
}

function stripStress(phoneme: string): string {
  return phoneme.replace(/\d/g, '')
}

function normalizePhonemes(phonemes: string[]): string[] {
  return phonemes.map(stripStress)
}

function isVowel(phoneme: string): boolean {
  return VOWELS.has(stripStress(phoneme))
}

function getLastStressedVowelIndex(phonemes: string[]): number {
  for (let i = phonemes.length - 1; i >= 0; i -= 1) {
    const phoneme = phonemes[i]
    if (isVowel(phoneme) && /[12]/.test(phoneme)) {
      return i
    }
  }
  return -1
}

function getLastVowelIndex(phonemes: string[]): number {
  for (let i = phonemes.length - 1; i >= 0; i -= 1) {
    if (isVowel(phonemes[i])) {
      return i
    }
  }
  return -1
}

function getStressDigit(phoneme: string): string | null {
  const match = phoneme.match(/\d/)
  return match ? match[0] : null
}

function consonantSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const featuresA = CONSONANT_FEATURES[a]
  const featuresB = CONSONANT_FEATURES[b]
  if (!featuresA || !featuresB) return 0

  let score = 0
  if (featuresA.place === featuresB.place) score += 0.45
  if (featuresA.manner === featuresB.manner) score += 0.35
  if (featuresA.voiced === featuresB.voiced) score += 0.2
  return score
}

function vowelSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (VOWEL_FAMILY[a] && VOWEL_FAMILY[a] === VOWEL_FAMILY[b]) return 0.6
  return 0.2
}

function getEndingConsonants(phonemes: string[], startIndex: number): string[] {
  const normalized = normalizePhonemes(phonemes)
  return normalized.slice(startIndex + 1).filter((phoneme) => !isVowel(phoneme))
}

function scoreEndingSimilarity(target: string[], candidate: string[]): number {
  if (!target.length || !candidate.length) return 0
  const comparisons = Math.min(target.length, candidate.length)
  let total = 0
  for (let i = 0; i < comparisons; i += 1) {
    const targetPhoneme = target[target.length - 1 - i]
    const candidatePhoneme = candidate[candidate.length - 1 - i]
    total += consonantSimilarity(targetPhoneme, candidatePhoneme)
  }
  return total / comparisons
}

function buildCacheKey(word: string, filters: RhymeWorkerFilters): string {
  return `${word}|p${filters.perfect ? 1 : 0}n${filters.near ? 1 : 0}s${filters.slant ? 1 : 0}`
}

function enqueueCache(key: string, value: RhymeWorkerResult) {
  memoryCache.set(key, value)
  if (memoryCache.size > MEMORY_CACHE_LIMIT) {
    const firstKey = memoryCache.keys().next().value
    if (firstKey) memoryCache.delete(firstKey)
  }
}

async function loadShard(letter: string): Promise<DictShard> {
  if (shardCache.has(letter)) return shardCache.get(letter) as DictShard

  try {
    const response = await fetch(`/data/cmudict/${letter}.json`)
    if (!response.ok) {
      shardCache.set(letter, {})
      return {}
    }
    const data = (await response.json()) as DictShard
    shardCache.set(letter, data)
    return data
  } catch {
    shardCache.set(letter, {})
    return {}
  }
}

async function computeRhymes(word: string, filters: RhymeWorkerFilters): Promise<RhymeWorkerResult> {
  const normalizedWord = normalizeWord(word)
  if (!normalizedWord) {
    return { perfect: [], near: [], slant: [] }
  }
  if (!filters.perfect && !filters.near && !filters.slant) {
    return { perfect: [], near: [], slant: [] }
  }

  const shardKey = normalizedWord[0]
  const shard = await loadShard(shardKey)
  const targetPhonemes = shard[normalizedWord]
  if (!targetPhonemes) {
    return { perfect: [], near: [], slant: [] }
  }

  const normalizedTarget = normalizePhonemes(targetPhonemes)
  const targetStressedIndex = getLastStressedVowelIndex(targetPhonemes)
  const targetStress = targetStressedIndex >= 0 ? getStressDigit(targetPhonemes[targetStressedIndex]) : null
  const targetTail = targetStressedIndex >= 0 ? normalizedTarget.slice(targetStressedIndex) : []
  const targetLastVowelIndex = getLastVowelIndex(targetPhonemes)
  const targetLastVowel = targetLastVowelIndex >= 0 ? stripStress(targetPhonemes[targetLastVowelIndex]) : null
  const targetEnding = targetLastVowelIndex >= 0 ? getEndingConsonants(targetPhonemes, targetLastVowelIndex) : []

  const perfect: ScoredCandidate[] = []
  const near: ScoredCandidate[] = []
  const slant: ScoredCandidate[] = []

  for (const [candidateWord, candidatePhonemes] of Object.entries(shard)) {
    if (candidateWord === normalizedWord) continue

    const candidateNormalized = normalizePhonemes(candidatePhonemes)
    const candidateStressedIndex = getLastStressedVowelIndex(candidatePhonemes)
    const candidateStress =
      candidateStressedIndex >= 0 ? getStressDigit(candidatePhonemes[candidateStressedIndex]) : null
    const candidateTail = candidateStressedIndex >= 0 ? candidateNormalized.slice(candidateStressedIndex) : []
    const candidateLastVowelIndex = getLastVowelIndex(candidatePhonemes)
    const candidateLastVowel =
      candidateLastVowelIndex >= 0 ? stripStress(candidatePhonemes[candidateLastVowelIndex]) : null
    const candidateEnding =
      candidateLastVowelIndex >= 0 ? getEndingConsonants(candidatePhonemes, candidateLastVowelIndex) : []

    const endingSimilarity = scoreEndingSimilarity(targetEnding, candidateEnding)

    if (filters.perfect && targetTail.length > 0 && targetTail.join(' ') === candidateTail.join(' ')) {
      if (targetStress === candidateStress) {
        perfect.push({ word: candidateWord, score: 1 })
        continue
      }
    }

    if (filters.near && targetLastVowel && targetLastVowel === candidateLastVowel) {
      if (endingSimilarity >= NEAR_THRESHOLD) {
        near.push({ word: candidateWord, score: 0.7 + 0.3 * endingSimilarity })
        continue
      }
    }

    if (filters.slant) {
      const vowelScore = vowelSimilarity(targetLastVowel, candidateLastVowel)
      const slantScore = 0.6 * endingSimilarity + 0.4 * vowelScore
      if (slantScore >= SLANT_THRESHOLD) {
        slant.push({ word: candidateWord, score: slantScore })
      }
    }
  }

  const sortCandidates = (items: ScoredCandidate[]) =>
    items
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.word.localeCompare(b.word)
      })
      .slice(0, MAX_RESULTS)
      .map((item) => item.word)

  return {
    perfect: sortCandidates(perfect),
    near: sortCandidates(near),
    slant: sortCandidates(slant),
  }
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function hydratePersistentCache() {
  try {
    const db = await openDatabase()
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const entries = (await promisifyRequest(store.getAll())) as Array<{
      key: string
      value: RhymeWorkerResult
      updatedAt?: number
    }>
    const sorted = entries
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, MEMORY_CACHE_LIMIT)
    for (const entry of sorted) {
      if (entry?.key && entry?.value) {
        memoryCache.set(entry.key, entry.value)
      }
    }
  } catch {
    // Ignore cache hydration failures; fallback to in-memory cache.
  }
}

async function persistCache(key: string, value: RhymeWorkerResult) {
  try {
    const db = await openDatabase()
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    store.put({ key, value, updatedAt: Date.now() })
  } catch {
    // Ignore persistence failures to keep worker responsive.
  }
}

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope

ctx.onmessage = async (event: MessageEvent<RhymeWorkerRequest>) => {
  const startedAt = performance.now()
  const { id, word, filters } = event.data

  await hydratePromise

  const normalizedWord = normalizeWord(word)
  const key = buildCacheKey(normalizedWord, filters)
  const cached = memoryCache.get(key)
  if (cached) {
    const response: RhymeWorkerResponse = {
      id,
      result: cached,
      durationMs: Math.round(performance.now() - startedAt),
    }
    ctx.postMessage(response)
    return
  }

  try {
    const result = await computeRhymes(word, filters)
    enqueueCache(key, result)
    persistCache(key, result)
    const response: RhymeWorkerResponse = {
      id,
      result,
      durationMs: Math.round(performance.now() - startedAt),
    }
    ctx.postMessage(response)
  } catch (error) {
    const response: RhymeWorkerResponse = {
      id,
      error: error instanceof Error ? error.message : 'Worker error',
      durationMs: Math.round(performance.now() - startedAt),
    }
    ctx.postMessage(response)
  }
}
