'use client'

export type ResolvedTheme = 'dark' | 'light'

export function resolveTheme(setting: 'dark' | 'light' | 'system'): ResolvedTheme {
  if (setting === 'dark' || setting === 'light') return setting
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
