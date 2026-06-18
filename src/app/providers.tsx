'use client'
import type { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import QueryProvider from '@/components/providers/QueryProvider'
import RhymeWorkerBootstrap from '@/components/RhymeWorkerBootstrap'
import RhymeHighlightSettingsHydrator from '@/components/settings/RhymeHighlightSettingsHydrator'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      enableSystem={false}
      storageKey="rhyme-lines:theme"
      disableTransitionOnChange
    >
      <QueryProvider>
        <RhymeWorkerBootstrap />
        <RhymeHighlightSettingsHydrator />
        {children}
      </QueryProvider>
    </ThemeProvider>
  )
}
