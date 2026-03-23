import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import TopBar from '@/components/TopBar'

export const metadata: Metadata = {
  title: 'Rhyme Lines',
  description: 'Distraction-free lyric editor',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex-col bg-black text-white antialiased font-sans">
        <Providers>
          <TopBar />
          <main className="flex min-h-0 flex-1" style={{ paddingTop: 'calc(var(--header-height, 48px) + 1rem)' }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
