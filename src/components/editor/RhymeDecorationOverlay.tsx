'use client'

import { useEffect, useMemo, useState } from 'react'
import type { RhymeDecorationRect } from '@/hooks/useRhymeDecorationOverlay'
import type { RhymeHighlightMode } from '@/lib/persist/schema'
import { shouldRenderRhymeToken } from '@/lib/rhyme/rhymeDecorations'
import { buildRhymeFamilyStyleMap } from '@/lib/rhyme/familyStyles'

export type RhymeDecorationOverlayProps = {
  rects: RhymeDecorationRect[]
  enabled: boolean
  activeFamilyId: number | null
  mode: RhymeHighlightMode
  hideColors: boolean
}

export function RhymeDecorationOverlay({ rects, enabled, activeFamilyId, mode, hideColors }: RhymeDecorationOverlayProps) {
  const [showDebugPronunciation, setShowDebugPronunciation] = useState(false)

  const familyStyles = useMemo(() => {
    const visibleFamilyIds = rects
      .filter((rect) => rect.familyId !== undefined)
      .map((rect) => rect.familyId as number)
    return buildRhymeFamilyStyleMap(visibleFamilyIds)
  }, [rects])

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
        const familyStyle = rect.familyId !== undefined ? familyStyles.get(rect.familyId) : undefined
        const color = familyStyle?.color ?? 'rgba(242, 201, 76, 0.95)'
        const underlineColor = hideColors ? 'rgba(242, 208, 0, 0.85)' : color
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
                top: rect.rect.top + rect.rect.height - 2,
                width: rect.rect.width,
                height: 0,
                borderBottomColor: underlineColor,
                borderBottomStyle: familyStyle?.lineStyle ?? 'solid',
                borderBottomWidth: `${familyStyle?.thickness ?? 2}px`,
                ['--rhyme-color' as string]: color,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
