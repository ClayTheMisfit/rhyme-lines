'use client'

import { useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const PANEL_SPACING_REM = '1.5rem'
const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

type ThemeChoice = 'dark' | 'light'
/**
 * Apply theme-specific CSS classes to document.body.
 *
 * Adds or removes utility classes to set the page background and text color for the given theme.
 * If document.body is not available, the function does nothing.
 *
 * @param theme - 'light' to apply light background and dark text, 'dark' to apply dark background and light text
 */
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

/**
 * Render the application's top bar with tab management, theme controls, rhyme UI toggles, autosave status, and settings access.
 *
 * @returns The JSX header element that contains the TabBar, theme toggle, rhyme decorations and panel toggles, autosave error indicator, and the settings sheet trigger.
 */
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
      className="fixed left-0 right-0 top-0 flex min-h-11 items-center justify-between gap-3 border-b border-white/[0.05] bg-[#0d0d0e] px-3 py-1.5"
      style={{ zIndex: layers.topBar }}
    >
      <div className="min-w-0 flex-1">
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          saveStatus={autosaveStatus}
          onNew={actions.newTab}
          onSelect={actions.setActive}
          onClose={actions.closeTab}
          onRename={handleRename}
        />
      </div>

      <div className="ml-2 flex items-center gap-1.5">
        {autosaveStatus === 'error' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-rose-300/35 text-sm text-rose-300"
                  aria-label={`Save failed${lastError ? `: ${lastError}` : ''}`}
                >
                  !
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{lastError ?? 'Save failed'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <motion.button
          suppressHydrationWarning
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.12 }}
          onClick={toggleTheme}
          className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-white/[0.04] bg-white/[0.01] text-[13px] text-white/50 transition-colors duration-100 hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </motion.button>

        <motion.button
          suppressHydrationWarning
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.12 }}
          onClick={toggleRhymeDecorations}
          className={cx(
            'inline-flex h-8 w-8 items-center justify-center rounded-sm border border-white/[0.04] bg-white/[0.01] text-[13px] transition duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25',
            showRhymeDecorations ? 'text-[#f2d000]' : 'text-white/50 hover:text-white/75'
          )}
          title={showRhymeDecorations ? 'Hide rhyme highlights' : 'Show rhyme highlights'}
          aria-label={showRhymeDecorations ? 'Hide rhyme highlights' : 'Show rhyme highlights'}
          aria-pressed={showRhymeDecorations}
        >
          Rh
        </motion.button>

        <motion.button
          suppressHydrationWarning
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.12 }}
          onClick={togglePanel}
          className={cx(
            'inline-flex h-8 w-8 items-center justify-center rounded-sm border border-white/[0.04] bg-white/[0.01] text-[13px] transition duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25',
            panelVisible ? 'text-[#f2d000]' : 'text-white/50 hover:text-white/75'
          )}
          title={panelVisible ? 'Hide rhyme panel' : 'Show rhyme panel'}
          aria-label={panelVisible ? 'Hide rhyme panel' : 'Show rhyme panel'}
          aria-pressed={panelVisible}
        >
          Rm
        </motion.button>

        <motion.div
          suppressHydrationWarning
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.12 }}
          className="flex"
          title="Open settings"
        >
          <SettingsSheet />
        </motion.div>
      </div>
    </header>
  )
}
