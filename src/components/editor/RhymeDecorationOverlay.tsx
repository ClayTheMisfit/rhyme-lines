'use client'

import { useMemo } from 'react'
import type { RhymeDecorationRect } from '@/hooks/useRhymeDecorationOverlay'
import { RHYME_FAMILY_COLORS } from '@/lib/rhyme/rhymeDecorations'

export type RhymeDecorationOverlayProps = {
  rects: RhymeDecorationRect[]
  enabled: boolean
}

export function RhymeDecorationOverlay({ rects, enabled }: RhymeDecorationOverlayProps) {
  const palette = useMemo(() => RHYME_FAMILY_COLORS, [])

  if (!enabled) return null

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {rects.map((rect) => {
        const color = palette[rect.familyId % palette.length]
        return (
          <div key={rect.id}>
            <span
              className="rl-rhyme-highlight"
              data-rhyme-family={rect.familyId}
              style={{
                left: rect.rect.left,
                top: rect.rect.top,
                width: rect.rect.width,
                height: rect.rect.height,
                ['--rhyme-color' as string]: color,
              }}
            />
            {rect.underline ? (
              <span
                className="rl-rhyme-underline"
                data-rhyme-family={rect.familyId}
                style={{
                  left: rect.rect.left,
                  top: rect.rect.top + rect.rect.height - 2,
                  width: rect.rect.width,
                  ['--rhyme-color' as string]: color,
                }}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
