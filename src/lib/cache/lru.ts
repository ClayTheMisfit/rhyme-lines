type SizeEstimator<V> = (value: V) => number

interface Entry<K, V> {
  key: K
  value: V
  size: number
}

export interface LRUStats {
  size: number
  maxSize: number
  currentWeight: number
}

export class LRUCache<K, V> {
  private map = new Map<K, Entry<K, V>>()
  private weight = 0

  constructor(
    private readonly maxSize: number = 100,
    private readonly estimateSize: SizeEstimator<V> = () => 1
  ) {}

  get(key: K): V | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    this.touch(entry)
    return entry.value
  }

  set(key: K, value: V): void {
    const size = Math.max(1, this.estimateSize(value))
    const existing = this.map.get(key)

    if (existing) {
      this.weight -= existing.size
    }

    const entry: Entry<K, V> = { key, value, size }
    this.map.set(key, entry)
    this.weight += size
    this.evict()
  }

  has(key: K): boolean {
    return this.map.has(key)
  }

  delete(key: K): void {
    const entry = this.map.get(key)
    if (entry) {
      this.weight -= entry.size
    }
    this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
    this.weight = 0
  }

  stats(): LRUStats {
    return {
      size: this.map.size,
      maxSize: this.maxSize,
      currentWeight: this.weight,
    }
  }

  private evict(): void {
    if (this.map.size <= this.maxSize && this.weight <= this.maxSize) return

    while ((this.map.size > this.maxSize || this.weight > this.maxSize) && this.map.size > 0) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      const entry = this.map.get(oldest)
      if (entry) {
        this.weight -= entry.size
      }
      this.map.delete(oldest)
    }
  }

  private touch(entry: Entry<K, V>): void {
    this.map.delete(entry.key)
    this.map.set(entry.key, entry)
  }
}
