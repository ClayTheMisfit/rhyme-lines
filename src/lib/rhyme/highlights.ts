export type RhymeHighlightKind = 'target' | 'perfect' | 'near' | 'slant'

export type RhymeHighlightCandidate = {
  word: string
  kind: Exclude<RhymeHighlightKind, 'target'>
}

const HIGHLIGHT_PRIORITY: Record<RhymeHighlightKind, number> = {
  target: 0,
  perfect: 1,
  near: 2,
  slant: 3,
}

const isStronger = (next: RhymeHighlightKind, current?: RhymeHighlightKind) => {
  if (!current) return true
  return HIGHLIGHT_PRIORITY[next] < HIGHLIGHT_PRIORITY[current]
}

export const buildRhymeHighlightMap = ({
  tokenIndex,
  candidates,
  targetTokenId,
}: {
  tokenIndex: Map<string, string[]>
  candidates: RhymeHighlightCandidate[]
  targetTokenId?: string | null
}) => {
  const highlights = new Map<string, RhymeHighlightKind>()

  const applyKind = (tokenId: string, kind: RhymeHighlightKind) => {
    const existing = highlights.get(tokenId)
    if (isStronger(kind, existing)) {
      highlights.set(tokenId, kind)
    }
  }

  for (const candidate of candidates) {
    const tokenIds = tokenIndex.get(candidate.word) ?? []
    for (const tokenId of tokenIds) {
      applyKind(tokenId, candidate.kind)
    }
  }

  if (targetTokenId) {
    applyKind(targetTokenId, 'target')
  }

  return highlights
}
