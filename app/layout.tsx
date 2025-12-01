import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import TopBar from '@/components/TopBar'
import RhymePanel from '@/components/RhymePanel'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rhyme Lines',
  description: 'Distraction-free lyric editor',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen flex flex-col`}>
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
