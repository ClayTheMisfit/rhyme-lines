'use client'

import { useEffect, useMemo, useState } from 'react'
import type { RhymeDecorationRect } from '@/hooks/useRhymeDecorationOverlay'
import type { RhymeHighlightMode } from '@/lib/persist/schema'
import { RHYME_FAMILY_COLORS, shouldRenderRhymeToken } from '@/lib/rhyme/rhymeDecorations'

export type RhymeDecorationOverlayProps = {
  rects: RhymeDecorationRect[]
  enabled: boolean
  activeFamilyId: number | null
  mode: RhymeHighlightMode
  hideColors: boolean
}

export function RhymeDecorationOverlay({ rects, enabled, activeFamilyId, mode, hideColors }: RhymeDecorationOverlayProps) {
  const palette = useMemo(() => RHYME_FAMILY_COLORS, [])
  const [showDebugPronunciation, setShowDebugPronunciation] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') {
      setShowDebugPronunciation(false)
      return
    }
    setShowDebugPronunciation(window.localStorage.getItem('debugPronunciation') === '1')
  }, [])

  if (!enabled) return null

  return (
    <div
      className={showDebugPronunciation ? 'absolute inset-0' : 'pointer-events-none absolute inset-0'}
      aria-hidden="true"
    >
      {rects.map((rect) => {
        if (!shouldRenderRhymeToken({ familyId: rect.familyId, isEndWord: rect.isEndWord }, mode, activeFamilyId)) {
          return null
        }
        const isActive = activeFamilyId !== null && rect.familyId === activeFamilyId
        const isMuted = mode === 'focus' && activeFamilyId !== null && rect.familyId !== activeFamilyId
        const color = palette[(rect.colorIndex ?? rect.familyId ?? 0) % palette.length]
        return (
          <div key={rect.id}>
            <span
              className="rl-rhyme-highlight"
              title={showDebugPronunciation ? rect.debugTitle?.() : undefined}
              data-rhyme-family={rect.familyId}
              data-rhyme-active={isActive || undefined}
              data-rhyme-muted={isMuted || undefined}
              data-rhyme-hide-colors={hideColors || undefined}
              data-rhyme-debug={showDebugPronunciation || undefined}
              style={{
                pointerEvents: showDebugPronunciation ? 'auto' : 'none',
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
                title={showDebugPronunciation ? rect.debugTitle?.() : undefined}
                data-rhyme-family={rect.familyId}
                data-rhyme-active={isActive || undefined}
                data-rhyme-muted={isMuted || undefined}
                data-rhyme-hide-colors={hideColors || undefined}
                data-rhyme-debug={showDebugPronunciation || undefined}
                style={{
                  pointerEvents: showDebugPronunciation ? 'auto' : 'none',
                  left: rect.rect.left,
                  top: rect.rect.top + rect.rect.height - 1,
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
