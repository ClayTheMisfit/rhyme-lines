'use client'

import type { ThemeSetting } from '@/lib/persist/schema'

export type ResolvedTheme = 'dark'

type ResolveThemeOptions = {
  hydrated?: boolean
}

export function resolveTheme(_setting: ThemeSetting, options: ResolveThemeOptions = {}): ResolvedTheme {
  void options
  return 'dark'
}
