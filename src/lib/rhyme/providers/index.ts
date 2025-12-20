import { fetchPerfectRhymes, fetchSlantRhymes } from './datamuse'
import { fetchRhymeBrainRhymes } from './rhymebrain'
import { generateLocalRhymes } from './local'
import type { AggregateOptions, RhymeFilterSelection, RhymeQuality } from '../aggregate'
import { normalizeQuality } from '../aggregate'

export interface ProviderCandidate {
  word: string
  quality: RhymeQuality
  score: number
  syllables?: number
  provider: string
}

export interface RhymeProvider {
  name: string
  supportsOffline?: boolean
  minIntervalMs?: number
  fetch: (word: string, options: AggregateOptions) => Promise<ProviderCandidate[]>
}

function shouldRequest(filters: RhymeFilterSelection, quality: RhymeQuality): boolean {
  return filters[quality]
}

const datamuse: RhymeProvider = {
  name: 'datamuse',
  minIntervalMs: 180,
  async fetch(word, options) {
    const results: ProviderCandidate[] = []

    if (shouldRequest(options.filters, 'perfect')) {
      const perfect = await fetchPerfectRhymes(word, options.signal)
      results.push(
        ...perfect.map((item) => ({
          word: item.word,
          quality: normalizeQuality(item.type),
          score: item.score,
          syllables: item.syllables,
          provider: 'datamuse',
        }))
      )
    }

    if (shouldRequest(options.filters, 'near') || shouldRequest(options.filters, 'slant')) {
      const near = await fetchSlantRhymes(word, options.signal)
      results.push(
        ...near.map((item) => ({
          word: item.word,
          quality: normalizeQuality(item.type),
          score: item.score,
          syllables: item.syllables,
          provider: 'datamuse',
        }))
      )
    }

    return results
  },
}

const rhymeBrain: RhymeProvider = {
  name: 'rhymebrain',
  minIntervalMs: 220,
  async fetch(word, options) {
    const rhymes = await fetchRhymeBrainRhymes(word, options.signal)
    return rhymes
      .filter((item) => shouldRequest(options.filters, normalizeQuality(item.type)))
      .map((item) => ({
        word: item.word,
        quality: normalizeQuality(item.type),
        score: item.score,
        syllables: item.syllables,
        provider: 'rhymebrain',
      }))
  },
}

const localProvider: RhymeProvider = {
  name: 'local',
  supportsOffline: true,
  minIntervalMs: 0,
  async fetch(word, options) {
    const rhymes = generateLocalRhymes(word)
    return rhymes
      .filter((item) => shouldRequest(options.filters, normalizeQuality(item.type)))
      .map((item) => ({
        word: item.word,
        quality: normalizeQuality(item.type),
        score: item.score,
        syllables: item.syllables,
        provider: 'local',
      }))
  },
}

export const providers: RhymeProvider[] = [localProvider, datamuse, rhymeBrain]
