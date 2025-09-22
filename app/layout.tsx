import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import TopBar from '@/components/TopBar'
import RhymePanel from '@/components/RhymePanel'
import QueryProvider from '@/components/providers/QueryProvider'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rhyme Lines Editor',
  description: 'A powerful editor for creating rhyming poetry and lyrics',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}>
        <QueryProvider>
          <TopBar />
          <RhymePanel />
          <div className="pt-12">
            {children}
          </div>
        </QueryProvider>
      </body>
    </html>
  )
}

