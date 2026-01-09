'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useMounted } from '@/hooks/useMounted'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useTabsStore } from '@/store/tabsStore'
import TabBar from '@/components/tabs/TabBar'
import { shallow } from 'zustand/shallow'
import SettingsSheet from './settings/SettingsSheet'

const PANEL_SPACING_REM = '1.5rem'
const SAVE_STATUS_START_DELAY_MS = 150
const SAVE_STATUS_HIDE_DELAY_MS = 2000

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

type ThemeChoice = 'dark' | 'light'
type SaveStatus = 'saving' | 'saved' | null

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null)
  const saveStatusRef = useRef<SaveStatus>(null)
  const saveStatusTimerRef = useRef<number | null>(null)
  const saveStartDelayRef = useRef<number | null>(null)
  const lastSaveTabIdRef = useRef<string | null>(null)

  const theme = useSettingsStore((state) => state.theme)
  const setThemePreference = useSettingsStore((state) => state.setTheme)
  const { resolvedTheme, setTheme: setResolvedTheme } = useTheme()

  const { togglePanel } = useRhymePanelStore((state) => ({ togglePanel: state.togglePanel }), shallow)
  const { mode, width: dockWidth, dock, undock } = useRhymePanel((state) => ({
    mode: state.mode,
    width: state.width,
    dock: state.dock,
    undock: state.undock,
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
  const detachDisabled = !panelVisible

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
    if (!resolvedTheme) return

    const resolved = resolvedTheme === 'dark' ? 'dark' : 'light'
    if (theme !== resolved) {
      setThemePreference(resolved)
    }
    applyBodyTheme(resolved)
  }, [mounted, resolvedTheme, setThemePreference, theme])

  useEffect(() => {
    if (!mounted) return
    const targetTheme: ThemeChoice = theme === 'dark' ? 'dark' : 'light'
    if (resolvedTheme !== targetTheme) {
      setResolvedTheme(targetTheme)
    }
  }, [mounted, resolvedTheme, setResolvedTheme, theme])

  useEffect(() => {
    saveStatusRef.current = saveStatus
  }, [saveStatus])

  useEffect(() => {
    if (!mounted) return

    const clearSaveStartDelay = () => {
      if (saveStartDelayRef.current) {
        window.clearTimeout(saveStartDelayRef.current)
        saveStartDelayRef.current = null
      }
    }

    const clearSaveStatusTimer = () => {
      if (saveStatusTimerRef.current) {
        window.clearTimeout(saveStatusTimerRef.current)
        saveStatusTimerRef.current = null
      }
    }

    const handleSaveStart = () => {
      const { activeTabId } = useTabsStore.getState()
      lastSaveTabIdRef.current = activeTabId
      clearSaveStatusTimer()

      if (saveStatusRef.current === 'saved') {
        setSaveStatus(null)
      }

      if (saveStatusRef.current === 'saving' || saveStartDelayRef.current) return

      saveStartDelayRef.current = window.setTimeout(() => {
        setSaveStatus('saving')
        saveStartDelayRef.current = null
      }, SAVE_STATUS_START_DELAY_MS)
    }

    const handleSaveComplete = () => {
      clearSaveStartDelay()
      const { actions } = useTabsStore.getState()
      const tabId = lastSaveTabIdRef.current ?? useTabsStore.getState().activeTabId
      if (tabId) {
        actions.markDirty(tabId, false)
      }
      setSaveStatus('saved')
      clearSaveStatusTimer()
      saveStatusTimerRef.current = window.setTimeout(() => {
        setSaveStatus(null)
        saveStatusTimerRef.current = null
      }, SAVE_STATUS_HIDE_DELAY_MS)
    }

    window.addEventListener('rhyme:save-start', handleSaveStart)
    window.addEventListener('rhyme:save-complete', handleSaveComplete)

    return () => {
      window.removeEventListener('rhyme:save-start', handleSaveStart)
      window.removeEventListener('rhyme:save-complete', handleSaveComplete)
      clearSaveStartDelay()
      clearSaveStatusTimer()
    }
  }, [mounted])

  const toggleTheme = useCallback(() => {
    const next: ThemeChoice = theme === 'dark' ? 'light' : 'dark'
    setThemePreference(next)
    setResolvedTheme(next)
  }, [setResolvedTheme, setThemePreference, theme])

  const handleDockToggle = useCallback(() => {
    if (detachDisabled) return
    if (isFloating) {
      dock()
    } else {
      undock()
    }
  }, [detachDisabled, dock, isFloating, undock])

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
      className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-4 py-2 shadow-[0_1px_10px_rgba(255,255,255,0.05)] backdrop-blur-md"
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
          {saveStatus ? (
            <motion.div
              key={saveStatus}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"
            >
              {saveStatus === 'saving' ? (
                <span className="inline-flex h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white/80" />
              ) : (
                <span className="text-emerald-300">✓</span>
              )}
              <span>{saveStatus === 'saving' ? 'Saving...' : 'All changes saved'}</span>
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

        <motion.button
          suppressHydrationWarning
          whileHover={{ scale: detachDisabled ? 1 : 1.05 }}
          whileTap={{ scale: detachDisabled ? 1 : 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={handleDockToggle}
          disabled={detachDisabled}
          aria-disabled={detachDisabled}
          className={cx(
            'inline-flex h-9 w-9 items-center justify-center rounded-md text-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
            isFloating ? 'bg-white/10 text-white' : 'text-white/80 hover:text-white',
            detachDisabled && 'cursor-not-allowed opacity-50'
          )}
          title={isFloating ? 'Dock rhyme panel' : 'Detach rhyme panel'}
        >
          ⧉
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
