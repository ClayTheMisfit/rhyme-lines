'use client'

import { useEffect, useRef, useState } from 'react'

const THEME_KEY = 'rhyme-lines:theme' // 'dark' | 'light'

function applyTheme(theme: 'dark' | 'light') {
  const body = document.body
  if (!body) return
  if (theme === 'light') {
    body.classList.remove('bg-black', 'text-white')
    body.classList.add('bg-white', 'text-black')
  } else {
    body.classList.remove('bg-white', 'text-black')
    body.classList.add('bg-black', 'text-white')
  }
}

export default function Toolbar() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const themeRef = useRef<'dark' | 'light'>('dark') // <-- keep live value

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark'
    setTheme(saved)
    themeRef.current = saved
    applyTheme(saved)

    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        // always use latest theme from ref
        const next = themeRef.current === 'dark' ? 'light' : 'dark'
        setTheme(next)
        themeRef.current = next
        localStorage.setItem(THEME_KEY, next)
        applyTheme(next)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    themeRef.current = next
    localStorage.setItem(THEME_KEY, next)
    applyTheme(next)
  }

  const toggleOverlays = () => {
    window.dispatchEvent(new CustomEvent('rhyme:toggle-overlays'))
  }

  return (
    <div className="fixed top-3 right-3 z-50">
      <div className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1 shadow-lg ring-1 ring-white/10 backdrop-blur">
        <button
          type="button"
          onClick={toggleOverlays}
          title="Toggle overlays (Alt+R)"
          className="text-xs px-2 py-1 rounded-md hover:bg-white/10"
        >
          🧩 Overlays
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          title="Toggle theme (Ctrl/Cmd+J)"
          className="text-xs px-2 py-1 rounded-md hover:bg-white/10"
        >
          🌓 Theme
        </button>
      </div>
    </div>
  )
}
