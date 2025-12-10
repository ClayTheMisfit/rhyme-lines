import { useEffect } from 'react'
import { BADGE_MODE_ORDER, BADGE_VARIANT_ORDER, useBadgeSettings } from '@/store/settings'

const cycleValue = <T,>(order: readonly T[], current: T): T => {
  const index = order.indexOf(current)
  if (index === -1) return order[0]
  return order[(index + 1) % order.length]
}

export function useBadgeShortcuts() {
  const badgeMode = useBadgeSettings((state) => state.badgeMode)
  const badgeVariant = useBadgeSettings((state) => state.badgeVariant)
  const setBadgeMode = useBadgeSettings((state) => state.setBadgeMode)
  const setBadgeVariant = useBadgeSettings((state) => state.setBadgeVariant)
  const bumpBadgeScale = useBadgeSettings((state) => state.bumpBadgeScale)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey) return
      if (!event.altKey) return

      const key = event.key

      if (key === 'b' || key === 'B') {
        if (event.shiftKey) {
          event.preventDefault()
          const next = cycleValue(BADGE_VARIANT_ORDER, badgeVariant)
          setBadgeVariant(next)
        } else {
          event.preventDefault()
          const next = cycleValue(BADGE_MODE_ORDER, badgeMode)
          setBadgeMode(next)
        }
        return
      }

      if (key === '=' || key === '+') {
        event.preventDefault()
        bumpBadgeScale(0.05)
        return
      }

      if (key === '-') {
        event.preventDefault()
        bumpBadgeScale(-0.05)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [badgeMode, badgeVariant, setBadgeMode, setBadgeVariant, bumpBadgeScale])
}
