import { createWithEqualityFn } from 'zustand/traditional'
import { assertClientOnly } from '@/lib/env/assertClientOnly'
import { isClient } from '@/lib/env/isClient'

export type BadgeMode = 'always' | 'activeLine' | 'hoverLine' | 'off'
export type BadgeVariant = 'numbers' | 'dots' | 'mixed'

type BadgeSettingsState = {
  badgeMode: BadgeMode
  badgeVariant: BadgeVariant
  badgeScale: number
  setBadgeMode: (mode: BadgeMode) => void
  setBadgeVariant: (variant: BadgeVariant) => void
  bumpBadgeScale: (delta: number) => void
}

const clampScale = (value: number) => Math.min(1.4, Math.max(0.8, Number.isFinite(value) ? value : 0.9))

const DEFAULT_BADGE_MODE: BadgeMode = 'activeLine'
const DEFAULT_BADGE_VARIANT: BadgeVariant = 'mixed'
const DEFAULT_BADGE_SCALE = 0.9

const readBadgeMode = (): BadgeMode => {
  if (!isClient()) {
    if (process.env.NODE_ENV === 'development') {
      assertClientOnly('badge-mode:read')
    }
    return DEFAULT_BADGE_MODE
  }
  const stored = window.localStorage.getItem('rl.badgeMode') as BadgeMode | null
  return stored ?? DEFAULT_BADGE_MODE
}

const readBadgeVariant = (): BadgeVariant => {
  if (!isClient()) {
    if (process.env.NODE_ENV === 'development') {
      assertClientOnly('badge-variant:read')
    }
    return DEFAULT_BADGE_VARIANT
  }
  const stored = window.localStorage.getItem('rl.badgeVariant') as BadgeVariant | null
  return stored ?? DEFAULT_BADGE_VARIANT
}

const readBadgeScale = (): number => {
  if (!isClient()) {
    if (process.env.NODE_ENV === 'development') {
      assertClientOnly('badge-scale:read')
    }
    return DEFAULT_BADGE_SCALE
  }
  const stored = window.localStorage.getItem('rl.badgeScale')
  const parsed = stored ? Number.parseFloat(stored) : NaN
  return clampScale(Number.isFinite(parsed) ? parsed : DEFAULT_BADGE_SCALE)
}

const persistValue = (key: string, value: string) => {
  if (!isClient()) {
    if (process.env.NODE_ENV === 'development') {
      assertClientOnly('badge-settings:persist')
    }
    return
  }
  try {
    window.localStorage.setItem(key, value)
  } catch {}
}

export const useBadgeSettings = createWithEqualityFn<BadgeSettingsState>()((set, get) => ({
  badgeMode: DEFAULT_BADGE_MODE,
  badgeVariant: DEFAULT_BADGE_VARIANT,
  badgeScale: DEFAULT_BADGE_SCALE,
  setBadgeMode: (badgeMode) => {
    persistValue('rl.badgeMode', badgeMode)
    set({ badgeMode })
  },
  setBadgeVariant: (badgeVariant) => {
    persistValue('rl.badgeVariant', badgeVariant)
    set({ badgeVariant })
  },
  bumpBadgeScale: (delta) => {
    const next = clampScale(Number((get().badgeScale + delta).toFixed(2)))
    persistValue('rl.badgeScale', next.toString())
    set({ badgeScale: next })
  },
}))

export const BADGE_MODE_ORDER: readonly BadgeMode[] = ['activeLine', 'hoverLine', 'always', 'off'] as const
export const BADGE_VARIANT_ORDER: readonly BadgeVariant[] = ['numbers', 'mixed', 'dots'] as const

export function hydrateBadgeSettings() {
  const badgeMode = readBadgeMode()
  const badgeVariant = readBadgeVariant()
  const badgeScale = readBadgeScale()
  useBadgeSettings.setState({ badgeMode, badgeVariant, badgeScale })
}
