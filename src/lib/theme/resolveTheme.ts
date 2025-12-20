'use client'

import { assertClientOnly } from '@/lib/env/assertClientOnly'
import { isClient } from '@/lib/env/isClient'
import type { ThemeSetting } from '@/lib/persist/schema'

export type ResolvedTheme = 'dark' | 'light'

type ResolveThemeOptions = {
  hydrated?: boolean
}

export function resolveTheme(setting: ThemeSetting, options: ResolveThemeOptions = {}): ResolvedTheme {
  if (setting === 'dark' || setting === 'light') return setting
  const hydrated = options.hydrated ?? false
  if (!hydrated || !isClient()) {
    if (process.env.NODE_ENV === 'development' && !isClient()) {
      assertClientOnly('theme:resolve')
    }
    return 'dark'
  }

  assertClientOnly('theme:match-media')
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
