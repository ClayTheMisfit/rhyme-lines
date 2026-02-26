'use client'

import { useMemo } from 'react'
import type { RhymeDecorationRect } from '@/hooks/useRhymeDecorationOverlay'
import { RHYME_FAMILY_COLORS, shouldRenderRhymeToken, type RhymeHighlightMode } from '@/lib/rhyme/rhymeDecorations'

export type RhymeDecorationOverlayProps = {
  rects: RhymeDecorationRect[]
  enabled: boolean
  activeFamilyId: number | null
  mode: RhymeHighlightMode
  hideColors: boolean
}

export function RhymeDecorationOverlay({ rects, enabled, activeFamilyId, mode, hideColors }: RhymeDecorationOverlayProps) {
  const palette = useMemo(() => RHYME_FAMILY_COLORS, [])

  if (!enabled) return null

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {rects.map((rect) => {
        if (!shouldRenderRhymeToken({
          id: rect.id,
          lineId: rect.lineId,
          lineIndex: 0,
          start: 0,
          end: 0,
          word: '',
          familyKey: '',
          familyId: rect.familyId,
          isEndWord: rect.isEndWord,
          underline: rect.underline,
        }, mode, activeFamilyId)) {
          return null
        }
        const isActive = activeFamilyId !== null && rect.familyId === activeFamilyId
        const isMuted = mode === 'focus' && activeFamilyId !== null && rect.familyId !== activeFamilyId
        const color = palette[(rect.colorIndex ?? rect.familyId ?? 0) % palette.length]
        return (
          <div key={rect.id}>
            <span
              className="rl-rhyme-highlight"
              data-rhyme-family={rect.familyId}
              data-rhyme-active={isActive || undefined}
              data-rhyme-muted={isMuted || undefined}
              data-rhyme-hide-colors={hideColors || undefined}
              style={{
                left: rect.rect.left,
                top: rect.rect.top,
                width: rect.rect.width,
                height: rect.rect.height,
                ['--rhyme-color' as string]: color,
              }}
            />
            {rect.underline || hideColors ? (
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
