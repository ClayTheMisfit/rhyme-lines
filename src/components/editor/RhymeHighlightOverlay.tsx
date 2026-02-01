'use client'

import { useMemo } from 'react'
import type { HighlightGroup } from '@/lib/rhyme/highlight'
import { buildTokenGroupIndex } from '@/lib/rhyme/highlight'
import type { ColorRegistry } from '@/lib/rhyme/colorRegistry'
import type { RhymeTokenPosition } from '@/lib/overlay/types'

// Integration notes (Step 1):
// - Editor surface: src/components/Editor.tsx contentEditable.
// - Overlay measurement: src/hooks/useOverlayMeasurement.ts (range-based rects).
// - Active line highlight: src/components/Editor.tsx (rl-current-line-highlight layer).
// - Analysis worker: src/workers/analysis.worker.ts + src/lib/analysis/compute.ts.
// - Tokenization: src/lib/analysis/tokenize.ts for word offsets.
// Rhyme highlighting renders in this overlay using the same rect measurement pipeline as syllable badges.
// Colors are assigned via a persistent registry to avoid collisions in the active viewport.

type RhymeHighlightOverlayProps = {
  enabled: boolean
  docId: string
  groups: HighlightGroup[]
  tokenPositions: RhymeTokenPosition[]
  activeGroupKey: string | null
  mode: 'all' | 'focus'
  viewportStart: number
  viewportEnd: number
  colorRegistry: ColorRegistry
}

const PILL_PADDING_X = 6
const PILL_PADDING_Y = 2
const UNDERLINE_HEIGHT = 2
const UNDERLINE_OFFSET = 2

const PALETTE = [
  '--rl-rhyme-c0',
  '--rl-rhyme-c1',
  '--rl-rhyme-c2',
  '--rl-rhyme-c3',
  '--rl-rhyme-c4',
  '--rl-rhyme-c5',
  '--rl-rhyme-c6',
  '--rl-rhyme-c7',
  '--rl-rhyme-c8',
  '--rl-rhyme-c9',
  '--rl-rhyme-c10',
  '--rl-rhyme-c11',
  '--rl-rhyme-c12',
  '--rl-rhyme-c13',
  '--rl-rhyme-c14',
  '--rl-rhyme-c15',
]

const isInViewport = (index: number, start: number, end: number) => {
  if (Number.isNaN(index)) return false
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true
  return index >= start && index <= end
}

const paletteVars = PALETTE.map((token) => `var(${token})`)

export function RhymeHighlightOverlay({
  enabled,
  docId,
  groups,
  tokenPositions,
  activeGroupKey,
  mode,
  viewportStart,
  viewportEnd,
  colorRegistry,
}: RhymeHighlightOverlayProps) {
  const tokenToGroup = useMemo(() => buildTokenGroupIndex(groups), [groups])
  const assignments = useMemo(() => colorRegistry.update(groups, paletteVars), [colorRegistry, groups])

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
          const isDimmed = mode === 'focus' && activeGroupKey && group.key !== activeGroupKey
          const assignment = assignments.get(group.key)
          if (!assignment) return []
          const isExact = group.kind === 'exact'
          const underlineY = (rect: (typeof token.rects)[number]) => rect.top + rect.height - UNDERLINE_OFFSET
          return token.rects.map((rect, index) =>
            isExact ? (
              <span
                key={`${token.tokenId}-${index}-underline-${docId}`}
                className={`rhyme-underline ${isDimmed ? 'rhyme-underline--dim' : ''}`}
                style={{
                  top: underlineY(rect),
                  left: rect.left,
                  width: rect.width,
                  height: UNDERLINE_HEIGHT,
                  backgroundColor: assignment.color,
                }}
              />
            ) : (
              <span
                key={`${token.tokenId}-${index}-pill-${docId}`}
                className={`rhyme-pill ${isDimmed ? 'rhyme-pill--dim' : ''}`}
                style={{
                  top: rect.top - PILL_PADDING_Y,
                  left: rect.left - PILL_PADDING_X,
                  width: rect.width + PILL_PADDING_X * 2,
                  height: rect.height + PILL_PADDING_Y * 2,
                  backgroundColor: assignment.color,
                }}
              />
            )
          )
        })}
    </div>
  )
}
