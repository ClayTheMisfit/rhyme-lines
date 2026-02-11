'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useMounted } from '@/hooks/useMounted'
import { resolveTheme } from '@/lib/theme/resolveTheme'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useTabsStore } from '@/store/tabsStore'
import { useAutosaveStore } from '@/store/autosaveStore'
import TabBar from '@/components/tabs/TabBar'
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
  const status = useAutosaveStore((state) => state.status)
  const lastError = useAutosaveStore((state) => state.lastError)
  const runSave = useAutosaveStore((state) => state.runSave)

  const { theme, setThemePreference, showRhymeDecorations, setShowRhymeDecorations } = useSettingsStore(
    (state) => ({
      theme: state.theme,
      setThemePreference: state.setTheme,
      showRhymeDecorations: state.showRhymeDecorations,
      setShowRhymeDecorations: state.setShowRhymeDecorations,
    })
  )
  const { resolvedTheme, setTheme: setResolvedTheme } = useTheme()

  const { togglePanel } = useRhymePanelStore((state) => ({ togglePanel: state.togglePanel }), shallow)
  const { mode, width: dockWidth } = useRhymePanel((state) => ({
    mode: state.mode,
    width: state.width,
  }))

  const { tabs, activeTabId, actions } = useTabsStore(
    (state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      actions: state.actions,
    }),
    shallow
  )

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

  const saveDisplay = useMemo(() => {
    switch (status) {
      case 'dirty':
        return { tone: 'warning', label: 'Unsaved changes' }
      case 'saving':
        return { tone: 'saving', label: 'Saving...' }
      case 'saved':
        return { tone: 'saved', label: 'All changes saved' }
      case 'error':
        return { tone: 'error', label: 'Save failed' }
      default:
        return null
    }
  }, [status])

  const toggleTheme = useCallback(() => {
    const next: ThemeChoice = theme === 'dark' ? 'light' : 'dark'
    setThemePreference(next)
    setResolvedTheme(next)
  }, [setResolvedTheme, setThemePreference, theme])

  const toggleRhymeDecorations = useCallback(() => {
    setShowRhymeDecorations(!showRhymeDecorations)
  }, [setShowRhymeDecorations, showRhymeDecorations])

  const handleRename = useCallback(
    (id: string, title: string) => {
      actions.renameTab(id, title)
    },
    [actions]
  )

  return (
    <header
      ref={headerRef}
      data-testid="editor-header"
      className="fixed left-0 right-0 top-0 flex items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-4 py-2 shadow-[0_1px_10px_rgba(255,255,255,0.05)] backdrop-blur-md"
      style={{ zIndex: layers.topBar }}
    >
      <div className="min-w-0 flex-1">
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onNew={actions.newTab}
          onSelect={actions.setActive}
          onClose={actions.closeTab}
          onRename={handleRename}
        />
      </div>

      <div className="ml-2 flex items-center gap-2">
        <AnimatePresence mode="wait">
          {saveDisplay ? (
            <motion.div
              key={saveDisplay.label}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"
            >
              {saveDisplay.tone === 'saving' ? (
                <span className="inline-flex h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white/80" />
              ) : saveDisplay.tone === 'error' ? (
                <span className="text-rose-300">!</span>
              ) : (
                <span className="text-emerald-300">✓</span>
              )}
              <span title={saveDisplay.tone === 'error' ? lastError ?? undefined : undefined}>{saveDisplay.label}</span>
              {saveDisplay.tone === 'error' && runSave ? (
                <button
                  type="button"
                  onClick={() => runSave()}
                  className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70 transition hover:text-white"
                >
                  Retry
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.button
          suppressHydrationWarning
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={toggleTheme}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-lg text-white/80 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          title="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </motion.button>

        <motion.button
          suppressHydrationWarning
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={toggleRhymeDecorations}
          className={cx(
            'inline-flex h-9 w-9 items-center justify-center rounded-md text-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
            showRhymeDecorations ? 'text-white bg-white/10' : 'text-white/80 hover:text-white'
          )}
          title={showRhymeDecorations ? 'Hide rhyme highlights' : 'Show rhyme highlights'}
          aria-pressed={showRhymeDecorations}
        >
          ✨
        </motion.button>

        <motion.button
          suppressHydrationWarning
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={togglePanel}
          className={cx(
            'inline-flex h-9 w-9 items-center justify-center rounded-md text-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
            panelVisible ? 'text-white bg-white/10' : 'text-white/80 hover:text-white'
          )}
          title={panelVisible ? 'Hide rhyme panel' : 'Show rhyme panel'}
          aria-pressed={panelVisible}
        >
          🎵
        </motion.button>

        <motion.div
          suppressHydrationWarning
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="flex"
          title="Open settings"
        >
          <SettingsSheet />
        </motion.div>
      </div>
    </header>
  )
}
