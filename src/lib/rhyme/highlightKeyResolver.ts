import { getRhymeClient } from '@/lib/rhyme-db/rhymeClientSingleton'
import type { RhymeKeyResponse } from '@/lib/rhyme-db/rhymeWorkerClient'
import { RhymeKeyCache } from '@/lib/rhyme/highlightKeyCache'

const keyCache = new RhymeKeyCache()
let lastRuntimeKey: string | null = null

const buildResult = (runtimeKey: string, tokens: string[]) => {
  const bucket = keyCache.getBucket(runtimeKey)
  const map = new Map<string, string | null>()
  for (const token of tokens) {
    map.set(token, bucket.get(token) ?? null)
  }
  return { runtimeKey, keys: map }
}

export async function resolveRhymeKeys(tokens: string[]): Promise<{ runtimeKey: string; keys: Map<string, string | null> }> {
  const uniqueTokens = Array.from(new Set(tokens)).filter(Boolean)
  if (!uniqueTokens.length) {
    return { runtimeKey: lastRuntimeKey ?? 'none', keys: new Map() }
  }

  if (lastRuntimeKey && lastRuntimeKey !== 'none') {
    const bucket = keyCache.getBucket(lastRuntimeKey)
    const hasAll = uniqueTokens.every((token) => bucket.has(token))
    if (hasAll) {
      return buildResult(lastRuntimeKey, uniqueTokens)
    }
  }

  try {
    const client = getRhymeClient()
    const response = (await client.getRhymeKeys(uniqueTokens)) as RhymeKeyResponse
    lastRuntimeKey = response.runtimeKey
    const bucket = keyCache.getBucket(response.runtimeKey)
    for (const [token, key] of Object.entries(response.keys)) {
      bucket.set(token, key)
    }
    return buildResult(response.runtimeKey, uniqueTokens)
  } catch {
    lastRuntimeKey = 'none'
    return buildResult('none', uniqueTokens)
  }
}
