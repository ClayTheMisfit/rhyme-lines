import { createWithEqualityFn } from 'zustand/traditional'

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

const readBadgeMode = (): BadgeMode => {
  if (typeof window === 'undefined') return 'activeLine'
  const stored = window.localStorage.getItem('rl.badgeMode') as BadgeMode | null
  return stored ?? 'activeLine'
}

const readBadgeVariant = (): BadgeVariant => {
  if (typeof window === 'undefined') return 'mixed'
  const stored = window.localStorage.getItem('rl.badgeVariant') as BadgeVariant | null
  return stored ?? 'mixed'
}

const readBadgeScale = (): number => {
  if (typeof window === 'undefined') return 0.9
  const stored = window.localStorage.getItem('rl.badgeScale')
  const parsed = stored ? Number.parseFloat(stored) : NaN
  return clampScale(Number.isFinite(parsed) ? parsed : 0.9)
}

const persistValue = (key: string, value: string) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {}
}

export const useBadgeSettings = createWithEqualityFn<BadgeSettingsState>()((set, get) => ({
  badgeMode: readBadgeMode(),
  badgeVariant: readBadgeVariant(),
  badgeScale: readBadgeScale(),
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
