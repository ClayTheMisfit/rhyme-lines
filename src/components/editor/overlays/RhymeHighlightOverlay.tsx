'use client'

import { useMemo } from 'react'
import type { RhymeHighlightKind } from '@/lib/rhyme/highlights'

export type RhymeOverlayRect = {
  top: number
  left: number
  width: number
  height: number
}

export type RhymeOverlayToken = {
  id: string
  text: string
  lowerText: string
  lineId: string
  lineIndex: number
  rects: RhymeOverlayRect[]
}

type RhymeHighlightOverlayProps = {
  tokens: RhymeOverlayToken[]
  highlights: Map<string, RhymeHighlightKind>
  enabled: boolean
}

type RenderedHighlight = {
  key: string
  rect: RhymeOverlayRect
  kind: RhymeHighlightKind
}

const computeInset = (rect: RhymeOverlayRect) => {
  const insetY = Math.min(4, Math.max(1, rect.height * 0.2))
  const insetX = Math.min(3, Math.max(1, rect.height * 0.15))
  return {
    top: rect.top + insetY,
    left: rect.left - insetX,
    width: rect.width + insetX * 2,
    height: Math.max(1, rect.height - insetY * 1.2),
  }
}

export function RhymeHighlightOverlay({ tokens, highlights, enabled }: RhymeHighlightOverlayProps) {
  const rendered = useMemo<RenderedHighlight[]>(() => {
    if (!enabled || highlights.size === 0) return []
    const items: RenderedHighlight[] = []
    for (const token of tokens) {
      const kind = highlights.get(token.id)
      if (!kind) continue
      token.rects.forEach((rect, rectIndex) => {
        const insetRect = computeInset(rect)
        items.push({
          key: `${token.id}-${rectIndex}-${kind}`,
          rect: insetRect,
          kind,
        })
      })
    }
    return items
  }, [enabled, highlights, tokens])

  if (!enabled || rendered.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true" data-testid="rhyme-highlight-overlay">
      {rendered.map((item) => (
        <div
          key={item.key}
          className="rl-rhyme-highlight"
          data-testid="rhyme-highlight"
          data-kind={item.kind}
          style={{
            top: item.rect.top,
            left: item.rect.left,
            width: item.rect.width,
            height: item.rect.height,
          }}
        />
      ))}
    </div>
  )
}
