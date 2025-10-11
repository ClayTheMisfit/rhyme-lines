'use client'

import { useMemo } from 'react'
import { OverlayBadge } from '@/src/components/editor/OverlayBadge'
import { useBadgeSettings } from '@/src/store/settings'

export type OverlayToken = {
  id: string
  value: number
  lineId: string
  lineIndex: number
  lineOffset: number
  rect: { top: number; centerX: number }
}

type SyllableOverlayProps = {
  tokens: OverlayToken[]
  activeLineId: string | null
  hoveredLineId: string | null
  viewportStart: number
  viewportEnd: number
  enabled: boolean
}

const isInViewport = (index: number, start: number, end: number) => {
  if (Number.isNaN(index)) return false
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true
  return index >= start && index <= end
}

export function SyllableOverlay({
  tokens,
  activeLineId,
  hoveredLineId,
  viewportStart,
  viewportEnd,
  enabled,
}: SyllableOverlayProps) {
  const { badgeMode } = useBadgeSettings((state) => ({ badgeMode: state.badgeMode }))

  const visibleTokens = useMemo(() => {
    if (!enabled || badgeMode === 'off') return []
    return tokens.filter((token) => {
      if (!isInViewport(token.lineIndex, viewportStart, viewportEnd)) {
        return false
      }
      switch (badgeMode) {
        case 'always':
          return true
        case 'activeLine':
          return token.lineId === activeLineId
        case 'hoverLine':
          return token.lineId === activeLineId || (!!hoveredLineId && token.lineId === hoveredLineId)
        case 'off':
        default:
          return false
      }
    })
  }, [tokens, badgeMode, activeLineId, hoveredLineId, viewportStart, viewportEnd, enabled])

  if (!enabled || badgeMode === 'off') {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {visibleTokens.map((token) => (
        <OverlayBadge
          key={token.id}
          value={token.value}
          active={token.lineId === activeLineId}
          position={{
            left: token.rect.centerX,
            top: token.rect.top,
            lineOffset: token.lineOffset,
          }}
        />
      ))}
    </div>
  )
}
