'use client'
import type { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import QueryProvider from '@/components/providers/QueryProvider'
import RhymeWorkerBootstrap from '@/components/RhymeWorkerBootstrap'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>
        <RhymeWorkerBootstrap />
        {children}
      </QueryProvider>
    </ThemeProvider>
  )
}
