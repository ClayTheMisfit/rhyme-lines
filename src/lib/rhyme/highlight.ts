import { STOPWORDS } from '@/lib/stopwords'

export type RhymeToken = {
  id: string
  lineId: string
  start: number
  end: number
  text: string
  norm: string
}

export type RhymeTokenMeta = {
  lineId: string
  start: number
  end: number
  text: string
  norm: string
}

export type HighlightGroup = {
  key: string
  tokenIds: string[]
  kind: 'perfect' | 'exact'
  order: number
}

export type RhymeHighlightResult = {
  tokens: RhymeToken[]
  groups: HighlightGroup[]
  tokenMetaById: Record<string, RhymeTokenMeta>
  activeGroupKey?: string
  scopeHash?: string
}

export type RhymeKeySource = 'phoneme' | 'none'

export type RhymeKeyResult = {
  key: string | null
  source: RhymeKeySource
}

export type RhymeKeyResolver = {
  getPerfectKey: (normalized: string) => string | null
}

export type BuildHighlightOptions = {
  includeExactRepeats?: boolean
  ignoreStopwords?: boolean
  resolver?: RhymeKeyResolver | null
  cache?: Map<string, RhymeKeyResult>
}

// Integration point: highlight keys only come from phoneme lookups to avoid false rhyme pills.

export const stableHash = (value: string) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return hash
}

export const computeRhymeKey = (
  normalized: string,
  resolver?: RhymeKeyResolver | null,
  cache?: Map<string, RhymeKeyResult>
): RhymeKeyResult => {
  if (!normalized) return { key: null, source: 'none' }
  if (cache?.has(normalized)) {
    return cache.get(normalized) ?? { key: null, source: 'none' }
  }

  const perfectKey = resolver?.getPerfectKey(normalized) ?? null
  if (perfectKey) {
    const result = { key: perfectKey, source: 'phoneme' } as const
    cache?.set(normalized, result)
    return result
  }

  const result = { key: null, source: 'none' } as const
  cache?.set(normalized, result)
  return result
}

const pushGroup = (
  groups: Map<string, HighlightGroup>,
  key: string,
  tokenId: string,
  kind: HighlightGroup['kind'],
  order: number
) => {
  const existing = groups.get(key)
  if (existing) {
    existing.tokenIds.push(tokenId)
    existing.order = Math.min(existing.order, order)
    return
  }
  groups.set(key, { key, tokenIds: [tokenId], kind, order })
}

export const buildTokenGroupIndex = (groups: HighlightGroup[]) => {
  const map = new Map<string, HighlightGroup>()
  const sorted = [...groups].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'perfect' ? -1 : 1
    return a.order - b.order
  })
  for (const group of sorted) {
    for (const tokenId of group.tokenIds) {
      if (map.has(tokenId)) continue
      map.set(tokenId, group)
    }
  }
  return map
}

export const getTokenHighlightStyle = (tokenId: string, groups: HighlightGroup[]) => {
  const group = buildTokenGroupIndex(groups).get(tokenId)
  if (!group) return null
  return group.kind === 'perfect' ? 'pill' : 'underline'
}

export const buildHighlightGroups = (tokens: RhymeToken[], options: BuildHighlightOptions = {}) => {
  const includeExactRepeats = options.includeExactRepeats ?? false
  const ignoreStopwords = options.ignoreStopwords ?? false
  const resolver = options.resolver ?? null
  const cache = options.cache
  const perfectGroups = new Map<string, HighlightGroup>()
  const exactGroups = new Map<string, HighlightGroup>()

  // Integration point: group order is used by the UI color registry for stable, collision-free colors.
  tokens.forEach((token, tokenIndex) => {
    if (!token.norm) return
    // Integration point: stopword filtering is controlled by highlight settings in the analysis worker.
    if (ignoreStopwords && STOPWORDS.has(token.norm)) return
    const keyResult = computeRhymeKey(token.norm, resolver ?? undefined, cache)
    if (keyResult.key) {
      pushGroup(perfectGroups, `rhyme:${keyResult.key}`, token.id, 'perfect', tokenIndex)
    }
    if (includeExactRepeats && token.norm && keyResult.source !== 'phoneme') {
      const exactKey = `exact:${token.norm}`
      pushGroup(exactGroups, exactKey, token.id, 'exact', tokenIndex)
    }
  })

  const finalize = (groups: Map<string, HighlightGroup>) =>
    Array.from(groups.values())
      .filter((group) => group.tokenIds.length >= 2)
      .sort((a, b) => a.order - b.order)

  return {
    groups: [...finalize(perfectGroups), ...finalize(exactGroups)],
  }
}
