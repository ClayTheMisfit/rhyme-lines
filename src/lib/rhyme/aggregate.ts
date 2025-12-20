import type { RhymeSuggestion } from './providers/datamuse'
import { normalizeRhymeToken } from './targetWord'
import type { ProviderCandidate, RhymeProvider } from './providers'
import { providers } from './providers'

export type RhymeQuality = 'perfect' | 'near' | 'slant'

export interface RhymeFilterSelection {
  perfect: boolean
  near: boolean
  slant: boolean
}

export interface AggregatedSuggestion {
  word: string
  normalized: string
  quality: RhymeQuality
  score: number
  syllables?: number
  sources: string[]
  providers: string[]
}

export interface AggregationResult {
  suggestions: AggregatedSuggestion[]
  buckets: Record<RhymeQuality, AggregatedSuggestion[]>
  providerStates: ProviderStateSnapshot[]
}

export interface ProviderStateSnapshot {
  name: string
  ok: boolean
  error?: string
  durationMs: number
  skipped?: boolean
}

export interface AggregateOptions {
  filters: RhymeFilterSelection
  signal: AbortSignal
  offline?: boolean
}

const QUALITY_PRIORITY: RhymeQuality[] = ['perfect', 'near', 'slant']
const MAX_RESULTS = 50

interface ProviderState {
  lastStart: number
  failCount: number
  backoffUntil: number
}

const providerState = new Map<string, ProviderState>()

function qualityPriority(quality: RhymeQuality): number {
  const idx = QUALITY_PRIORITY.indexOf(quality)
  return idx === -1 ? QUALITY_PRIORITY.length : idx
}

export function normalizeQuality(type: RhymeSuggestion['type'] | 'near'): RhymeQuality {
  if (type === 'perfect') return 'perfect'
  if (type === 'near') return 'near'
  return 'slant'
}

function rankCandidates(candidates: AggregatedSuggestion[], filters: RhymeFilterSelection) {
  const activeQualities = QUALITY_PRIORITY.filter((quality) => filters[quality])

  candidates.sort((a, b) => {
    const aQualityPriority = activeQualities.indexOf(a.quality)
    const bQualityPriority = activeQualities.indexOf(b.quality)

    if (aQualityPriority !== bQualityPriority) {
      return (aQualityPriority === -1 ? 99 : aQualityPriority) - (bQualityPriority === -1 ? 99 : bQualityPriority)
    }

    if (b.score !== a.score) {
      return b.score - a.score
    }

    if ((a.syllables ?? 0) !== (b.syllables ?? 0)) {
      return (a.syllables ?? Number.POSITIVE_INFINITY) - (b.syllables ?? Number.POSITIVE_INFINITY)
    }

    return a.normalized.localeCompare(b.normalized)
  })
}

function mergeCandidates(
  raw: ProviderCandidate[],
  filters: RhymeFilterSelection
): AggregatedSuggestion[] {
  const map = new Map<string, AggregatedSuggestion>()

  for (const item of raw) {
    const normalized = normalizeRhymeToken(item.word)
    if (!filters[item.quality]) continue

    const existing = map.get(normalized)
    if (!existing) {
      map.set(normalized, {
        word: item.word,
        normalized,
        quality: item.quality,
        score: item.score,
        syllables: item.syllables,
        sources: [item.provider],
        providers: [item.provider],
      })
      continue
    }

    const currentPriority = qualityPriority(existing.quality)
    const nextPriority = qualityPriority(item.quality)
    if (nextPriority < currentPriority) {
      existing.quality = item.quality
    }

    if (item.score > existing.score) {
      existing.score = item.score
    }

    if (item.syllables && !existing.syllables) {
      existing.syllables = item.syllables
    }

    if (!existing.providers.includes(item.provider)) {
      existing.providers.push(item.provider)
    }
  }

  const merged = Array.from(map.values())
  rankCandidates(merged, filters)
  return merged.slice(0, MAX_RESULTS)
}

async function wait(ms: number, signal: AbortSignal) {
  if (ms <= 0) return
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timeout)
      signal.removeEventListener('abort', onAbort)
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    if (!signal.aborted) {
      setTimeout(() => signal.removeEventListener('abort', onAbort), ms)
    }
  })
}

async function invokeProvider(
  word: string,
  provider: RhymeProvider,
  options: AggregateOptions
): Promise<{ candidates: ProviderCandidate[]; snapshot: ProviderStateSnapshot }> {
  const state = providerState.get(provider.name) ?? { lastStart: 0, failCount: 0, backoffUntil: 0 }
  const now = Date.now()

  if (state.backoffUntil > now) {
    return {
      candidates: [],
      snapshot: {
        name: provider.name,
        ok: false,
        skipped: true,
        durationMs: 0,
        error: 'backoff',
      },
    }
  }

  const minInterval = provider.minIntervalMs ?? 150
  const waitMs = Math.max(0, state.lastStart + minInterval - now)
  if (waitMs > 0) {
    await wait(waitMs, options.signal)
  }

  const started = Date.now()
  try {
    const results = await provider.fetch(word, options)
    providerState.set(provider.name, { lastStart: Date.now(), failCount: 0, backoffUntil: 0 })
    return {
      candidates: results,
      snapshot: {
        name: provider.name,
        ok: true,
        durationMs: Date.now() - started,
      },
    }
  } catch (error) {
    const nextFail = state.failCount + 1
    const backoffUntil = Date.now() + Math.min(1000 + nextFail * 250, 4000)
    providerState.set(provider.name, {
      lastStart: Date.now(),
      failCount: nextFail,
      backoffUntil,
    })
    return {
      candidates: [],
      snapshot: {
        name: provider.name,
        ok: false,
        durationMs: Date.now() - started,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }
}

export async function fetchAggregatedRhymes(
  word: string,
  options: AggregateOptions
): Promise<AggregationResult> {
  const tasks = providers
    .filter((provider) => options.offline ? provider.supportsOffline : true)
    .map((provider) => invokeProvider(word, provider, options))

  const settled = await Promise.all(tasks)
  const candidates = settled.flatMap((item) => item.candidates)
  const snapshots = settled.map((item) => item.snapshot)

  const suggestions = mergeCandidates(candidates, options.filters)
  const buckets: AggregationResult['buckets'] = {
    perfect: [],
    near: [],
    slant: [],
  }

  for (const suggestion of suggestions) {
    buckets[suggestion.quality].push(suggestion)
  }

  return { suggestions, buckets, providerStates: snapshots }
}

export function resetProviderState() {
  providerState.clear()
}

export function dedupeForTest(candidates: ProviderCandidate[], filters: RhymeFilterSelection) {
  return mergeCandidates(candidates, filters)
}
