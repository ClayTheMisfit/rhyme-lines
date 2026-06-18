import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Rhyme Lines',
  description: 'Distraction-free lyric editor',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-black font-sans text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
