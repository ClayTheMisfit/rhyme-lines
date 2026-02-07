import { STOPWORDS } from '@/lib/rhyme/stopwords'

export type HighlightKind = 'perfect' | 'exact'

export type HighlightMember = {
  lineId: string
  tokenIndex: number
}

export type HighlightGroup = {
  kind: HighlightKind
  key: string
  members: HighlightMember[]
  freq: number
}

export type HighlightToken = {
  lineId: string
  tokenIndex: number
  norm: string
  text: string
  rhymeKey?: string | null
}

export type HighlightAssignment = {
  kind: HighlightKind
  groupKey: string
}

export type HighlightBuildResult = {
  groups: HighlightGroup[]
  assignments: Map<string, HighlightAssignment>
}

const kindOrder: Record<HighlightKind, number> = { perfect: 0, exact: 1 }

const tokenId = (token: HighlightMember) => `${token.lineId}:${token.tokenIndex}`

const sortGroups = (groups: HighlightGroup[]) =>
  [...groups].sort((a, b) => {
    const kindDelta = kindOrder[a.kind] - kindOrder[b.kind]
    if (kindDelta !== 0) return kindDelta
    if (a.freq !== b.freq) return b.freq - a.freq
    return a.key.localeCompare(b.key)
  })

export function buildHighlightGroups(options: {
  tokens: HighlightToken[]
  includeExactRepeats: boolean
  ignoreStopwords: boolean
  rhymeKeysByNorm: Map<string, string | null>
}): HighlightBuildResult {
  const filteredTokens = options.tokens.filter((token) => {
    if (!token.norm) return false
    if (options.ignoreStopwords && STOPWORDS.has(token.norm)) return false
    return true
  })

  const perfectGroups = new Map<string, HighlightGroup>()
  for (const token of filteredTokens) {
    const rhymeKey = options.rhymeKeysByNorm.get(token.norm) ?? null
    if (!rhymeKey) continue
    const key = `perfect:${rhymeKey}`
    const existing = perfectGroups.get(key)
    if (existing) {
      existing.members.push({ lineId: token.lineId, tokenIndex: token.tokenIndex })
      existing.freq += 1
    } else {
      perfectGroups.set(key, {
        kind: 'perfect',
        key,
        members: [{ lineId: token.lineId, tokenIndex: token.tokenIndex }],
        freq: 1,
      })
    }
  }

  const exactGroups = new Map<string, HighlightGroup>()
  if (options.includeExactRepeats) {
    for (const token of filteredTokens) {
      const key = `exact:${token.norm}`
      const existing = exactGroups.get(key)
      if (existing) {
        existing.members.push({ lineId: token.lineId, tokenIndex: token.tokenIndex })
        existing.freq += 1
      } else {
        exactGroups.set(key, {
          kind: 'exact',
          key,
          members: [{ lineId: token.lineId, tokenIndex: token.tokenIndex }],
          freq: 1,
        })
      }
    }
  }

  const perfectList = Array.from(perfectGroups.values()).filter((group) => group.freq >= 2)
  const exactList = Array.from(exactGroups.values()).filter((group) => group.freq >= 2)
  const orderedGroups = sortGroups([...perfectList, ...exactList])

  const assignments = new Map<string, HighlightAssignment>()
  const perfectMemberIds = new Set<string>()

  for (const group of perfectList) {
    for (const member of group.members) {
      perfectMemberIds.add(tokenId(member))
    }
  }

  for (const group of orderedGroups) {
    for (const member of group.members) {
      const id = tokenId(member)
      if (assignments.has(id)) continue
      if (group.kind === 'exact' && perfectMemberIds.has(id)) continue
      assignments.set(id, { kind: group.kind, groupKey: group.key })
    }
  }

  return { groups: orderedGroups, assignments }
}
