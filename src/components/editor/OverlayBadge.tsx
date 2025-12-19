'use client'

import type { CSSProperties } from 'react'
import clsx from 'clsx'
import { useBadgeSettings } from '@/store/settings'

type OverlayBadgeProps = {
  value: number
  active: boolean
  position: { left: number; top: number; lineOffset: number }
  lineId: string
}

export function OverlayBadge({ value, active, position, lineId }: OverlayBadgeProps) {
  const { badgeScale, badgeVariant } = useBadgeSettings((state) => ({
    badgeScale: state.badgeScale,
    badgeVariant: state.badgeVariant,
  }))

  const resolvedVariant = badgeVariant === 'mixed' ? (active ? 'numbers' : 'dots') : badgeVariant
  const dotCount = Math.min(value, 6)
  const content =
    resolvedVariant === 'numbers'
      ? String(value)
      : `${'•'.repeat(dotCount)}${value > 6 ? '⁺' : ''}`

  const offset = Number.isFinite(position.lineOffset) && position.lineOffset > 0 ? position.lineOffset : 0.95
  const style: CSSProperties & { ['--badge-offset']?: string; ['--badge-scale']?: string } = {
    left: `${position.left}px`,
    top: `calc(${position.top}px - var(--badge-offset, 0.95em))`,
    paddingInline: resolvedVariant === 'numbers' ? undefined : '2px',
    ['--badge-offset']: `${offset}em`,
    ['--badge-scale']: String(badgeScale),
  }

  return (
    <span
      aria-hidden
      title={`${value} syllable${value === 1 ? '' : 's'}`}
      className={clsx(
        'syllable-badge absolute',
        resolvedVariant === 'dots' && 'syllable-badge--dots'
      )}
      data-line-id={lineId}
      style={style}
    >
      {content}
    </span>
  )
}
