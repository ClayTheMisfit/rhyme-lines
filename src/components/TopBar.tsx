'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useMounted } from '@/hooks/useMounted'
import { useTheme } from 'next-themes'
import { resolveTheme } from '@/lib/theme/resolveTheme'
import { useSettingsStore } from '@/store/settingsStore'
import { layers } from '@/lib/layers'
import DocumentHeader from '@/components/DocumentHeader'
import TopBarActions from '@/components/TopBarActions'
import { useRhymePanel } from '@/lib/state/rhymePanel'

const PANEL_SPACING_REM = '1.25rem'


function resetBodyThemeToDashboardDefault() {
  const body = document.body
  if (!body) return
  body.classList.remove('bg-white', 'text-black')
  body.classList.add('bg-black', 'text-white')
}

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

    return () => {
      resetBodyThemeToDashboardDefault()
    }
  }, [mounted, resolvedTheme, setResolvedTheme, theme])

  return (
    <header
      ref={headerRef}
      data-testid="editor-header"
      className="fixed left-0 right-0 top-0 flex min-h-12 items-center gap-2.5 border-b border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-chrome)] px-4 py-2 text-[color:var(--rl-shell-text)]"
      style={{ zIndex: layers.topBar }}
    >
      <Link
        href="/"
        aria-label="Back to dashboard"
        className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-[color:var(--rl-shell-border)] bg-[color:color-mix(in_srgb,var(--rl-shell-elevated)_72%,transparent)] px-2.5 text-xs text-[color:var(--rl-shell-muted)] transition-colors hover:text-[color:var(--rl-shell-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]"
      >
        <span aria-hidden>←</span>
        <span>Back</span>
      </Link>
      <DocumentHeader />
      <TopBarActions />
    </header>
  )
}
