'use client'
import type { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import QueryProvider from '@/components/providers/QueryProvider'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>{children}</QueryProvider>
    </ThemeProvider>
  )
}
