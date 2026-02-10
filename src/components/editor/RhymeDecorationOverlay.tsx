'use client'

import { useMemo } from 'react'
import type { RhymeDecorationRect } from '@/hooks/useRhymeDecorationOverlay'
import { RHYME_FAMILY_COLORS } from '@/lib/rhyme/rhymeDecorations'

export type RhymeDecorationOverlayProps = {
  rects: RhymeDecorationRect[]
  enabled: boolean
  activeFamilyId: number | null
}

export function RhymeDecorationOverlay({ rects, enabled, activeFamilyId }: RhymeDecorationOverlayProps) {
  const palette = useMemo(() => RHYME_FAMILY_COLORS, [])

  if (!enabled) return null

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {rects.map((rect) => {
        if (rect.familyId === undefined) {
          return null
        }
        const isActive = activeFamilyId !== null && rect.familyId === activeFamilyId
        const isMuted = activeFamilyId !== null && rect.familyId !== activeFamilyId
        const color = palette[rect.familyId % palette.length]
        return (
          <div key={rect.id}>
            <span
              className="rl-rhyme-highlight"
              data-rhyme-family={rect.familyId}
              data-rhyme-active={isActive || undefined}
              data-rhyme-muted={isMuted || undefined}
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
                data-rhyme-active={isActive || undefined}
                data-rhyme-muted={isMuted || undefined}
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
