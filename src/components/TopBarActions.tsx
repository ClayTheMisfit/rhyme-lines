'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useSettingsStore } from '@/store/settingsStore'
import { shallow } from 'zustand/shallow'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { useClickOutside } from '@/hooks/useClickOutside'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const buttonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-sm border border-white/[0.05] bg-white/[0.02] text-[11px] text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20'

export default function TopBarActions() {
  const { theme, setThemePreference, showRhymeDecorations, setShowRhymeDecorations } = useSettingsStore(
    (state) => ({
      theme: state.theme,
      setThemePreference: state.setTheme,
      showRhymeDecorations: state.showRhymeDecorations,
      setShowRhymeDecorations: state.setShowRhymeDecorations,
    }),
    shallow
  )
  const { setTheme: setResolvedTheme } = useTheme()
  const { togglePanel } = useRhymePanelStore((state) => ({ togglePanel: state.togglePanel }), shallow)
  const mode = useRhymePanel((state) => state.mode)
  const panelVisible = mode !== 'hidden'
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useClickOutside(menuRef, () => setMenuOpen(false))

  const themeGlyph = useMemo(() => (theme === 'dark' ? '☾' : '☀'), [theme])

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemePreference(next)
    setResolvedTheme(next)
  }, [setResolvedTheme, setThemePreference, theme])

  return (
    <div className="ml-auto flex items-center gap-1.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button whileTap={{ scale: 0.97 }} className={buttonClass} onClick={toggleTheme} aria-label="Toggle theme">
              {themeGlyph}
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Theme</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={togglePanel}
              className={`${buttonClass} ${panelVisible ? 'text-[#f2d000]/90' : ''}`}
              title={panelVisible ? 'Hide rhyme panel (Alt+R)' : 'Show rhyme panel (Alt+R)'}
              aria-label={panelVisible ? 'Hide rhyme panel' : 'Show rhyme panel'}
              aria-pressed={panelVisible}
            >
              ≡
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Rhyme panel · Alt+R</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="relative" ref={menuRef}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setMenuOpen((open) => !open)}
          className={buttonClass}
          title="More actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="More actions"
        >
          ⋯
        </motion.button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-9 z-40 min-w-[220px] rounded-md border border-white/[0.08] bg-[#111113] p-1.5 shadow-2xl"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between rounded px-2.5 py-2 text-left text-xs text-white/78 hover:bg-white/[0.05]"
              onClick={() => {
                setShowRhymeDecorations(!showRhymeDecorations)
                setMenuOpen(false)
              }}
            >
              <span>Rhyme highlights</span>
              <span className="text-white/45">{showRhymeDecorations ? 'On' : 'Off'}</span>
            </button>
            <button
              type="button"
              className="mt-1 flex w-full items-center justify-between rounded border-t border-white/[0.06] px-2.5 py-2 text-left text-xs text-white/78 hover:bg-white/[0.05]"
              onClick={() => {
                setMenuOpen(false)
                setSettingsOpen(true)
              }}
            >
              <span>Editor settings</span>
              <span className="text-white/45">↗</span>
            </button>
          </div>
        ) : null}
      </div>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} hideTrigger />
    </div>
  )
}
