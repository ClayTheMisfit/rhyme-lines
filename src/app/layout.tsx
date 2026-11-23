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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var theme=null;var settings=localStorage.getItem("rhyme-lines:persist:settings");if(settings){var parsed=JSON.parse(settings);var candidate=parsed&&parsed.data&&parsed.data.theme;if(candidate==="dark"||candidate==="light"||candidate==="system"){theme=candidate}}if(!theme){var legacy=localStorage.getItem("theme");if(legacy==="dark"||legacy==="light"||legacy==="system"){theme=legacy}}theme=theme||"dark";var resolved=theme==="system"?window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light":theme;document.documentElement.classList.toggle("dark",resolved==="dark");document.documentElement.classList.toggle("light",resolved==="light");document.documentElement.style.colorScheme=resolved}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
