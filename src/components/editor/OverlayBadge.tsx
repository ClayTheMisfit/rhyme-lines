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
    top: `calc(${position.top}px + var(--line-offset, -1.05em))`,
    minWidth: resolvedVariant === 'numbers' ? `${16 * badgeScale}px` : undefined,
    height: `${16 * badgeScale}px`,
    transform: `translate(-50%, 0) scale(${badgeScale})`,
    paddingInline: resolvedVariant === 'numbers' ? '0px' : '2px',
    ['--line-offset']: `${position.lineOffset}px`,
  }

  return (
    <span
      aria-hidden
      title={`${value} syllable${value === 1 ? '' : 's'}`}
      className={clsx(
        'absolute pointer-events-none -translate-x-1/2 select-none',
        'rounded-full ring-1 ring-border/30 bg-background/50 backdrop-blur-[1px]',
        'text-muted-foreground leading-none flex items-center justify-center',
        resolvedVariant === 'numbers'
          ? 'text-[10px] font-medium px-[4px]'
          : 'text-[9px] tracking-tight'
      )}
      style={style}
    >
      {content}
    </span>
  )
}
