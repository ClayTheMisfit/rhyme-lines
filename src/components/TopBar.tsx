'use client'

import { useEffect, useRef } from 'react'
import { useMounted } from '@/hooks/useMounted'
import { useTheme } from 'next-themes'
import { resolveTheme } from '@/lib/theme/resolveTheme'
import { useSettingsStore } from '@/store/settingsStore'
import { layers } from '@/lib/layers'
import DocumentHeader from '@/components/DocumentHeader'
import TopBarActions from '@/components/TopBarActions'
import { useRhymePanel } from '@/lib/state/rhymePanel'

const PANEL_SPACING_REM = '1.25rem'

function applyBodyTheme(theme: 'light' | 'dark') {
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

export default function TopBar() {
  const mounted = useMounted()
  const headerRef = useRef<HTMLElement>(null)
  const { theme } = useSettingsStore((state) => ({ theme: state.theme }))
  const { resolvedTheme, setTheme: setResolvedTheme } = useTheme()
  const { mode, width } = useRhymePanel((state) => ({
    mode: state.mode,
    width: state.width,
  }))

  useEffect(() => {
    if (!mounted) return
    const header = headerRef.current
    if (!header) return

    const root = document.documentElement
    const updateHeight = () => root.style.setProperty('--header-height', `${header.offsetHeight}px`)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(header)
    return () => observer.disconnect()
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    const panelVisible = mode !== 'hidden' && mode !== 'detached'
    const offset = panelVisible ? Math.max(0, width) : 0
    const value = panelVisible ? `calc(${Math.round(offset)}px + ${PANEL_SPACING_REM})` : '0px'
    const rafId = window.requestAnimationFrame(() => {
      root.style.setProperty('--panel-right-offset', value)
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [mode, mounted, width])

  useEffect(() => {
    const root = document.documentElement
    return () => {
      root.style.setProperty('--panel-right-offset', '0px')
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    const resolved = resolveTheme(theme, { hydrated: mounted })
    applyBodyTheme(resolved)
    if (resolvedTheme !== resolved) {
      setResolvedTheme(resolved)
    }
  }, [mounted, resolvedTheme, setResolvedTheme, theme])

  return (
    <header
      ref={headerRef}
      data-testid="editor-header"
      className="fixed left-0 right-0 top-0 flex min-h-12 items-center gap-3 border-b border-white/[0.06] bg-[#0d0d0f] px-4 py-2"
      style={{ zIndex: layers.topBar }}
    >
      <DocumentHeader />
      <TopBarActions />
    </header>
  )
}
