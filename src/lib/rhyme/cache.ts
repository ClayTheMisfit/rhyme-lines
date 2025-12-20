import { LRUCache } from '../cache/lru'
import type { AggregationResult, RhymeFilterSelection } from './aggregate'

interface CacheEntry {
  result: AggregationResult
  timestamp: number
}

const MAX_ENTRIES = 200
const TTL = 10 * 60 * 1000

const cache = new LRUCache<string, CacheEntry>(MAX_ENTRIES, (entry) => entry.result.suggestions.length + 1)

export function buildCacheKey(target: string, filters: RhymeFilterSelection): string {
  const filterKey = ['perfect', 'near', 'slant']
    .map((key) => `${key}:${filters[key as keyof RhymeFilterSelection] ? '1' : '0'}`)
    .join('|')
  return `${target.toLowerCase().trim()}|${filterKey}`
}

export function getCachedRhymes(key: string): AggregationResult | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > TTL) {
    cache.delete(key)
    return null
  }
  return entry.result
}

export function setCachedRhymes(key: string, result: AggregationResult) {
  cache.set(key, { result, timestamp: Date.now() })
}

export function clearRhymeCache() {
  cache.clear()
}

export function cacheStats() {
  return cache.stats()
}
