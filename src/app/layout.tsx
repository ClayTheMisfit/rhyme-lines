import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import TopBar from '@/components/TopBar'
import RhymePanel from '@/components/RhymePanel'

export const metadata: Metadata = {
  title: 'Rhyme Lines',
  description: 'Distraction-free lyric editor',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-black text-white min-h-screen flex flex-col font-sans">
        <Providers>
          <TopBar />
          <RhymePanel />
          <main className="flex-1 flex min-h-0" style={{ paddingTop: 'var(--header-height, 48px)' }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
