import type { AggregatedSuggestion } from './aggregate'

interface CacheEntry {
  data: AggregatedSuggestion[]
  timestamp: number
  type: 'perfect' | 'slant'
}


class RhymeCache {
  private cache = new Map<string, CacheEntry>()
  private maxSize = 100 // Maximum number of entries
  private ttl = 10 * 60 * 1000 // 10 minutes in milliseconds
  private pendingRequests = new Map<string, Promise<AggregatedSuggestion[]>>()

  private generateKey(word: string, type: 'perfect' | 'slant'): string {
    return `${word.toLowerCase()}:${type}`
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.ttl
  }

  private evictOldest(): void {
    if (this.cache.size < this.maxSize) return

    let oldestKey = ''
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  get(word: string, type: 'perfect' | 'slant'): AggregatedSuggestion[] | null {
    const key = this.generateKey(word, type)
    const entry = this.cache.get(key)

    if (!entry) return null
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  set(word: string, type: 'perfect' | 'slant', data: AggregatedSuggestion[]): void {
    const key = this.generateKey(word, type)
    
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      type,
    })
  }

  has(word: string, type: 'perfect' | 'slant'): boolean {
    const key = this.generateKey(word, type)
    const entry = this.cache.get(key)
    return entry !== undefined && !this.isExpired(entry)
  }

  // Prevent duplicate requests for the same key
  async getOrFetch(
    word: string, 
    type: 'perfect' | 'slant', 
    fetcher: () => Promise<AggregatedSuggestion[]>
  ): Promise<AggregatedSuggestion[]> {
    const key = this.generateKey(word, type)
    
    // Check cache first
    const cached = this.get(word, type)
    if (cached) return cached

    // Check if request is already pending
    const pending = this.pendingRequests.get(key)
    if (pending) return pending

    // Start new request
    const promise = fetcher().then(result => {
      this.set(word, type, result)
      this.pendingRequests.delete(key)
      return result
    }).catch(error => {
      this.pendingRequests.delete(key)
      throw error
    })

    this.pendingRequests.set(key, promise)
    return promise
  }

  clear(): void {
    this.cache.clear()
    this.pendingRequests.clear()
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      pendingRequests: this.pendingRequests.size,
    }
  }
}

export const rhymeCache = new RhymeCache()
