'use client'

import { applyAlpha } from '@/lib/rhyme/highlightColors'

export type RhymeHighlightItem = {
  id: string
  kind: 'perfect' | 'exact'
  color: string
  rect: { top: number; left: number; width: number; height: number }
}

type RhymeHighlightOverlayProps = {
  items: RhymeHighlightItem[]
  enabled: boolean
}

const PILL_PADDING_X = 3
const PILL_PADDING_Y = 1
const UNDERLINE_HEIGHT = 2
const UNDERLINE_OFFSET = 2

export function RhymeHighlightOverlay({ items, enabled }: RhymeHighlightOverlayProps) {
  if (!enabled || !items.length) return null

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true" data-testid="rhyme-highlight-layer">
      {items.map((item) => {
        if (item.kind === 'exact') {
          return (
            <div
              key={item.id}
              className="rl-rhyme-underline"
              data-testid="rhyme-underline"
              style={{
                left: `${item.rect.left}px`,
                top: `${item.rect.top + item.rect.height + UNDERLINE_OFFSET}px`,
                width: `${item.rect.width}px`,
                height: `${UNDERLINE_HEIGHT}px`,
                backgroundColor: item.color,
              }}
            />
          )
        }

        return (
          <div
            key={item.id}
            className="rl-rhyme-pill"
            data-testid="rhyme-pill"
            style={{
              left: `${item.rect.left - PILL_PADDING_X}px`,
              top: `${item.rect.top - PILL_PADDING_Y}px`,
              width: `${item.rect.width + PILL_PADDING_X * 2}px`,
              height: `${item.rect.height + PILL_PADDING_Y * 2}px`,
              backgroundColor: applyAlpha(item.color, 0.18),
            }}
          />
        )
      })}
    </div>
  )
}
