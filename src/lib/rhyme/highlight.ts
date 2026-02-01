export type RhymeToken = {
  id: string
  lineId: string
  start: number
  end: number
  text: string
  norm: string
}

export type HighlightGroup = {
  rhymeKey: string
  tokenIds: string[]
  kind: 'perfect' | 'exact'
}

export type RhymeHighlightResult = {
  tokens: RhymeToken[]
  groups: HighlightGroup[]
  activeGroupKey?: string
}

export type RhymeKeySource = 'phoneme' | 'ortho' | 'none'

export type RhymeKeyResult = {
  key: string | null
  source: RhymeKeySource
}

export type RhymeKeyResolver = {
  getPerfectKey: (normalized: string) => string | null
}

export type BuildHighlightOptions = {
  includeExactRepeats?: boolean
  resolver?: RhymeKeyResolver | null
  cache?: Map<string, RhymeKeyResult>
}

const ORTHO_MIN_LENGTH = 4
const ORTHO_TAIL_LEN = 4

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

  if (normalized.length >= ORTHO_MIN_LENGTH) {
    const tail = normalized.slice(-ORTHO_TAIL_LEN)
    const result = { key: `ortho:${tail}`, source: 'ortho' } as const
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
  kind: HighlightGroup['kind']
) => {
  const existing = groups.get(key)
  if (existing) {
    existing.tokenIds.push(tokenId)
    return
  }
  groups.set(key, { rhymeKey: key, tokenIds: [tokenId], kind })
}

export const buildHighlightGroups = (tokens: RhymeToken[], options: BuildHighlightOptions = {}) => {
  const includeExactRepeats = options.includeExactRepeats ?? false
  const resolver = options.resolver ?? null
  const cache = options.cache
  const perfectGroups = new Map<string, HighlightGroup>()
  const exactGroups = new Map<string, HighlightGroup>()

  for (const token of tokens) {
    if (!token.norm) continue
    const keyResult = computeRhymeKey(token.norm, resolver ?? undefined, cache)
    if (keyResult.key) {
      pushGroup(perfectGroups, keyResult.key, token.id, 'perfect')
    }
    if (includeExactRepeats && token.norm && keyResult.source !== 'phoneme') {
      const exactKey = `exact:${token.norm}`
      pushGroup(exactGroups, exactKey, token.id, 'exact')
    }
  }

  const finalize = (groups: Map<string, HighlightGroup>) =>
    Array.from(groups.values())
      .filter((group) => group.tokenIds.length >= 2)
      .sort((a, b) => a.rhymeKey.localeCompare(b.rhymeKey))

  return {
    groups: [...finalize(perfectGroups), ...finalize(exactGroups)],
  }
}
