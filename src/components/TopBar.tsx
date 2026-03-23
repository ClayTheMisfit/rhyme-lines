'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { useMounted } from '@/hooks/useMounted'
import { resolveTheme } from '@/lib/theme/resolveTheme'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useAutosaveStore } from '@/store/autosaveStore'
import { shallow } from 'zustand/shallow'
import SettingsSheet from './settings/SettingsSheet'
import { layers } from '@/lib/layers'

const PANEL_SPACING_REM = '1.5rem'
const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

type ThemeChoice = 'dark' | 'light'

function applyBodyTheme(theme: ThemeChoice) {
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
  const { status: autosaveStatus, lastError } = useAutosaveStore((state) => ({
    status: state.status,
    lastError: state.lastError,
  }), shallow)

  const { theme, setThemePreference, showRhymeDecorations, setShowRhymeDecorations } = useSettingsStore(
    (state) => ({
      theme: state.theme,
      setThemePreference: state.setTheme,
      showRhymeDecorations: state.showRhymeDecorations,
      setShowRhymeDecorations: state.setShowRhymeDecorations,
    }),
    shallow
  )
  const { resolvedTheme, setTheme: setResolvedTheme } = useTheme()

  const { togglePanel } = useRhymePanelStore((state) => ({ togglePanel: state.togglePanel }), shallow)
  const { mode, width: dockWidth } = useRhymePanel((state) => ({
    mode: state.mode,
    width: state.width,
  }))

  const panelVisible = mode !== 'hidden'
  const isFloating = mode === 'detached'

  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    const offset = panelVisible && !isFloating ? Math.max(0, dockWidth) : 0
    const value = panelVisible && !isFloating
      ? `calc(${Math.round(offset)}px + ${PANEL_SPACING_REM})`
      : '0px'

    const rafId = window.requestAnimationFrame(() => {
      root.style.setProperty('--panel-right-offset', value)
    })

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [dockWidth, isFloating, panelVisible, mounted])

  useEffect(() => {
    const root = document.documentElement
    return () => {
      root.style.setProperty('--panel-right-offset', '0px')
      root.style.setProperty('--gutter-px', '36px')
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    const header = headerRef.current
    if (!header) return

    const root = document.documentElement
    const updateHeight = () => {
      const height = header.offsetHeight
      root.style.setProperty('--header-height', `${height}px`)
    }

    updateHeight()

    const observer = new ResizeObserver(() => {
      updateHeight()
    })
    observer.observe(header)

    return () => observer.disconnect()
  }, [mounted])

  useEffect(() => {
    if (!mounted) return

    const resolved = resolveTheme(theme, { hydrated: mounted })
    applyBodyTheme(resolved)
    if (resolvedTheme !== resolved) {
      setResolvedTheme(resolved)
    }
  }, [mounted, resolvedTheme, setResolvedTheme, theme])

  const toggleTheme = useCallback(() => {
    const next: ThemeChoice = theme === 'dark' ? 'light' : 'dark'
    setThemePreference(next)
    setResolvedTheme(next)
  }, [setResolvedTheme, setThemePreference, theme])

  const toggleRhymeDecorations = useCallback(() => {
    setShowRhymeDecorations(!showRhymeDecorations)
  }, [setShowRhymeDecorations, showRhymeDecorations])

  return (
    <header
      ref={headerRef}
      data-testid="editor-header"
      className="fixed left-0 right-0 top-0 flex h-12 items-center justify-between border-b border-[color:var(--rl-border)] bg-[color:var(--rl-bg)] px-6"
      style={{ zIndex: layers.topBar }}
    >
      <div className="w-[240px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--rl-accent)]">
        Lyricist
      </div>

      <nav className="flex flex-1 items-center justify-center gap-8 text-xs uppercase tracking-[0.09em]">
        <button type="button" className="border-l border-[color:var(--rl-accent)] pl-3 text-[color:var(--rl-accent)]">Projects</button>
        <button type="button" className="text-[color:var(--rl-muted)] hover:text-[color:var(--rl-text)]">Library</button>
        <button type="button" className="text-[color:var(--rl-muted)] hover:text-[color:var(--rl-text)]">Archive</button>
      </nav>

      <div className="flex w-[240px] items-center justify-end gap-1">
        <span className="mr-2 text-[10px] uppercase tracking-[0.16em] text-[color:var(--rl-muted)]">
          {autosaveStatus === 'saving' ? 'Syncing' : autosaveStatus === 'dirty' ? 'Pending' : autosaveStatus === 'error' ? 'Error' : 'Saved'}
        </span>
        {autosaveStatus === 'error' && (
          <span
            className="inline-flex h-7 items-center border border-red-400/40 px-2 text-[10px] uppercase tracking-[0.14em] text-red-300"
            aria-label={`Save failed${lastError ? `: ${lastError}` : ''}`}
            title={lastError ?? 'Save failed'}
          >
            !
          </span>
        )}

        <button
          onClick={togglePanel}
          className={cx(
            'inline-flex h-7 min-w-7 items-center justify-center border px-2 text-xs transition duration-75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--rl-accent)]',
            panelVisible
              ? 'border-[color:var(--rl-accent)] text-[color:var(--rl-accent)]'
              : 'border-transparent text-[color:var(--rl-muted)] hover:border-[color:var(--rl-border)] hover:text-[color:var(--rl-text)]'
          )}
          title={panelVisible ? 'Hide rhyme panel' : 'Show rhyme panel'}
          aria-label={panelVisible ? 'Hide rhyme panel' : 'Show rhyme panel'}
          aria-pressed={panelVisible}
        >
          ◫
        </button>

        <button
          onClick={toggleRhymeDecorations}
          className={cx(
            'inline-flex h-7 min-w-7 items-center justify-center border px-2 text-xs transition duration-75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--rl-accent)]',
            showRhymeDecorations
              ? 'border-[color:var(--rl-accent)] text-[color:var(--rl-accent)]'
              : 'border-transparent text-[color:var(--rl-muted)] hover:border-[color:var(--rl-border)] hover:text-[color:var(--rl-text)]'
          )}
          title={showRhymeDecorations ? 'Hide rhyme highlights' : 'Show rhyme highlights'}
          aria-label={showRhymeDecorations ? 'Hide rhyme highlights' : 'Show rhyme highlights'}
          aria-pressed={showRhymeDecorations}
        >
          ◌
        </button>

        <button
          onClick={toggleTheme}
          className="inline-flex h-7 min-w-7 items-center justify-center border border-transparent px-2 text-xs text-[color:var(--rl-muted)] transition-colors duration-75 hover:border-[color:var(--rl-border)] hover:text-[color:var(--rl-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--rl-accent)]"
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '◐' : '◑'}
        </button>

        <div className="flex border border-transparent px-1 text-[color:var(--rl-muted)] hover:border-[color:var(--rl-border)]" title="Open settings">
          <SettingsSheet />
        </div>
      </div>
    </header>
  )
}
