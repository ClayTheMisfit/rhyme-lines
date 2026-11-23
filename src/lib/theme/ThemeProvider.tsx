'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSettingsStore, hydrateSettingsStore } from '@/store/settingsStore'
import { readWithMigrations, writeVersioned } from '@/lib/persist/storage'
import { STORAGE_KEYS, type SettingsSchema } from '@/lib/persist/schema'

export type Theme = 'dark' | 'light' | 'system'

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: 'dark' | 'light'
  systemTheme: 'dark' | 'light'
  themes: Theme[]
  setTheme: (theme: Theme) => void
}

const LEGACY_STORAGE_KEY = 'theme'
const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  resolvedTheme: 'dark',
  systemTheme: 'dark',
  themes: ['dark', 'light', 'system'],
  setTheme: () => {},
})

const systemTheme = (): 'dark' | 'light' =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'

const applyTheme = (theme: 'dark' | 'light') => {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.classList.toggle('light', theme === 'light')
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSettingsStore((state) => state.theme)
  const [system, setSystem] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const currentSystem = systemTheme()
    setSystem(currentSystem)

    try {
      const settings = readWithMigrations('settings')
      if (settings.status === 'ok') {
        const storedTheme = settings.data.theme
        if (storedTheme === 'dark' || storedTheme === 'light' || storedTheme === 'system') {
          hydrateSettingsStore(settings.data)
        }
      } else {
        const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
        if (legacy === 'dark' || legacy === 'light' || legacy === 'system') {
          const migrated: SettingsSchema = { ...useSettingsStore.getState(), theme: legacy }
          hydrateSettingsStore(migrated)
          writeVersioned('settings', migrated)
        }
      }
    } catch {}

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemChange = () => {
      const next = systemTheme()
      setSystem(next)
    }
    media.addEventListener('change', handleSystemChange)
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LEGACY_STORAGE_KEY) {
        if (event.newValue === 'dark' || event.newValue === 'light' || event.newValue === 'system') {
          useSettingsStore.getState().setTheme(event.newValue)
        }
        return
      }
      if (event.key !== STORAGE_KEYS.settings || !event.newValue) return
      try {
        const payload = JSON.parse(event.newValue) as { data?: SettingsSchema }
        if (!payload.data) return
        const next = payload.data.theme
        if (next === 'dark' || next === 'light' || next === 'system') {
          hydrateSettingsStore(payload.data)
        }
      } catch {}
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      media.removeEventListener('change', handleSystemChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    applyTheme(theme === 'system' ? system : theme)
  }, [system, theme])

  const setTheme = useCallback((next: Theme) => {
    useSettingsStore.getState().setTheme(next)
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    resolvedTheme: theme === 'system' ? system : theme,
    systemTheme: system,
    themes: ['dark', 'light', 'system'],
    setTheme,
  }), [setTheme, system, theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
