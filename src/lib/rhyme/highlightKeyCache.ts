export class RhymeKeyCache {
  private store = new Map<string, Map<string, string | null>>()

  get(runtimeKey: string, token: string) {
    return this.store.get(runtimeKey)?.get(token)
  }

  set(runtimeKey: string, token: string, value: string | null) {
    if (!this.store.has(runtimeKey)) {
      this.store.set(runtimeKey, new Map())
    }
    const bucket = this.store.get(runtimeKey)
    if (!bucket) return
    bucket.set(token, value)
  }

  getBucket(runtimeKey: string) {
    if (!this.store.has(runtimeKey)) {
      this.store.set(runtimeKey, new Map())
    }
    return this.store.get(runtimeKey) ?? new Map()
  }
}
