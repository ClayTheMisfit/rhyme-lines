'use client'

import { useMemo } from 'react'
import type { HighlightGroup } from '@/lib/rhyme/highlight'
import { stableHash } from '@/lib/rhyme/highlight'
import type { RhymeTokenPosition } from '@/lib/overlay/types'

// Integration notes (Step 1):
// - Editor surface: src/components/Editor.tsx contentEditable.
// - Overlay measurement: src/hooks/useOverlayMeasurement.ts (range-based rects).
// - Active line highlight: src/components/Editor.tsx (rl-current-line-highlight layer).
// - Analysis worker: src/workers/analysis.worker.ts + src/lib/analysis/compute.ts.
// - Tokenization: src/lib/analysis/tokenize.ts for word offsets.
// Rhyme highlighting renders in this overlay using the same rect measurement pipeline as syllable badges.

type RhymeHighlightOverlayProps = {
  enabled: boolean
  groups: HighlightGroup[]
  tokenPositions: RhymeTokenPosition[]
  activeGroupKey: string | null
  mode: 'all' | 'focus'
  viewportStart: number
  viewportEnd: number
}

const PILL_PADDING_X = 6
const PILL_PADDING_Y = 2

const PALETTE = ['--rl-rhyme-1', '--rl-rhyme-2', '--rl-rhyme-3', '--rl-rhyme-4', '--rl-rhyme-5', '--rl-rhyme-6']

const isInViewport = (index: number, start: number, end: number) => {
  if (Number.isNaN(index)) return false
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true
  return index >= start && index <= end
}

const getColorVar = (key: string) => {
  const hash = Math.abs(stableHash(key))
  const colorIndex = hash % PALETTE.length
  return `var(${PALETTE[colorIndex]})`
}

export function RhymeHighlightOverlay({
  enabled,
  groups,
  tokenPositions,
  activeGroupKey,
  mode,
  viewportStart,
  viewportEnd,
}: RhymeHighlightOverlayProps) {
  const tokenToGroup = useMemo(() => {
    const map = new Map<string, HighlightGroup>()
    const sorted = [...groups].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'perfect' ? -1 : 1
      return a.rhymeKey.localeCompare(b.rhymeKey)
    })
    for (const group of sorted) {
      for (const tokenId of group.tokenIds) {
        if (map.has(tokenId)) continue
        map.set(tokenId, group)
      }
    }
    return map
  }, [groups])

  if (!enabled || tokenPositions.length === 0 || groups.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {tokenPositions
        .filter((token) => isInViewport(token.lineIndex, viewportStart, viewportEnd))
        .flatMap((token) => {
          const group = tokenToGroup.get(token.tokenId)
          if (!group) return []
          const isDimmed = mode === 'focus' && activeGroupKey && group.rhymeKey !== activeGroupKey
          const backgroundColor = getColorVar(group.rhymeKey)
          return token.rects.map((rect, index) => (
            <span
              key={`${token.tokenId}-${index}`}
              className={`rhyme-pill ${isDimmed ? 'rhyme-pill--dim' : ''}`}
              style={{
                top: rect.top - PILL_PADDING_Y,
                left: rect.left - PILL_PADDING_X,
                width: rect.width + PILL_PADDING_X * 2,
                height: rect.height + PILL_PADDING_Y * 2,
                backgroundColor,
              }}
            />
          ))
        })}
    </div>
  )
}
