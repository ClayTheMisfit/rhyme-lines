import { normalizeRhymeToken } from './targetWord'
import { fetchWorkerRhymes } from './workerClient'
import type { RhymeWorkerResult } from './workerTypes'

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
}

export interface AggregateOptions {
  filters: RhymeFilterSelection
  signal: AbortSignal
  offline?: boolean
}

export async function fetchAggregatedRhymes(
  word: string,
  options: AggregateOptions
): Promise<AggregationResult> {
  const startedAt = performance.now()
  const { data, durationMs } = await fetchWorkerRhymes(word, options.filters, options.signal)
  const buckets: AggregationResult['buckets'] = {
    perfect: [],
    near: [],
    slant: [],
  }

  const seen = new Set<string>()
  const suggestions: AggregatedSuggestion[] = []
  const qualities: RhymeQuality[] = ['perfect', 'near', 'slant']
  const resultsByQuality: Record<RhymeQuality, RhymeWorkerResult[RhymeQuality]> = {
    perfect: data.perfect,
    near: data.near,
    slant: data.slant,
  }

  for (const quality of qualities) {
    const words = resultsByQuality[quality]
    for (let index = 0; index < words.length; index += 1) {
      const suggestionWord = words[index]
      const normalized = normalizeRhymeToken(suggestionWord)
      if (seen.has(normalized)) continue
      seen.add(normalized)
      const score = Math.max(1, words.length - index)
      const suggestion: AggregatedSuggestion = {
        word: suggestionWord,
        normalized,
        quality,
        score,
        sources: ['local-worker'],
        providers: ['local-worker'],
      }
      suggestions.push(suggestion)
      buckets[quality].push(suggestion)
    }
  }

  return {
    suggestions,
    buckets,
    providerStates: [
      {
        name: 'local-worker',
        ok: true,
        durationMs: durationMs || Math.round(performance.now() - startedAt),
      },
    ],
  }
}
