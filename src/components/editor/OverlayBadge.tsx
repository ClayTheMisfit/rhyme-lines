'use client'

import type { CSSProperties } from 'react'
import clsx from 'clsx'
import { useBadgeSettings } from '@/src/store/settings'

type OverlayBadgeProps = {
  value: number
  active: boolean
  position: { left: number; top: number; lineOffset: number }
}

export function OverlayBadge({ value, active, position }: OverlayBadgeProps) {
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

  const style: CSSProperties & { ['--line-offset']?: string } = {
    left: `${position.left}px`,
    top: `calc(${position.top}px + var(--line-offset, 0px) - var(--badge-offset, 0.95em))`,
    transform: `translate(-50%, 0) scale(${badgeScale})`,
    ['--line-offset']: `${position.lineOffset}px`,
  }

  return (
    <span
      aria-hidden
      title={`${value} syllable${value === 1 ? '' : 's'}`}
      data-variant={resolvedVariant}
      className={clsx('syllable-badge absolute')}
      style={style}
    >
      {content}
    </span>
  )
}
