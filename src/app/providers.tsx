'use client'
import type { ReactNode } from 'react'
import { ThemeProvider } from '@/lib/theme/ThemeProvider'
import QueryProvider from '@/components/providers/QueryProvider'
import RhymeWorkerBootstrap from '@/components/RhymeWorkerBootstrap'
import RhymeHighlightSettingsHydrator from '@/components/settings/RhymeHighlightSettingsHydrator'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <RhymeWorkerBootstrap />
        <RhymeHighlightSettingsHydrator />
        {children}
      </QueryProvider>
    </ThemeProvider>
  )
}
