'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useEditorDensityStore } from '@/store/editorDensityStore'
import { useTabsStore } from '@/store/tabsStore'
import { shallow } from 'zustand/shallow'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { useClickOutside } from '@/hooks/useClickOutside'
import { CommandPalette, type CommandPaletteItem } from '@/components/CommandPalette'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { trackEvent } from '@/lib/analytics/events'

const buttonClass =
  'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border border-[color:var(--rl-shell-border)] bg-[color:color-mix(in_srgb,var(--rl-shell-elevated)_74%,transparent)] text-[11px] text-[color:var(--rl-shell-muted)] transition-colors hover:text-[color:var(--rl-shell-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rl-shell-border)]'

type ShortcutAction = 'palette' | 'theme' | 'rhymes' | 'export' | 'rhymeHighlightMode'

export default function TopBarActions() {
  const router = useRouter()
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
  const tabs = useTabsStore((state) => state.tabs)
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const { newTab, setActive } = useTabsStore(
    (state) => ({ newTab: state.actions.newTab, setActive: state.actions.setActive }),
    shallow
  )
  const { densityMode, setDensityMode } = useEditorDensityStore(
    (state) => ({ densityMode: state.mode, setDensityMode: state.setMode }),
    shallow
  )

  const panelVisible = mode !== 'hidden'
  const toggleRhymePanel = useCallback(() => {
    trackEvent('rhyme_panel_toggled', { visible: !panelVisible })
    togglePanel()
  }, [panelVisible, togglePanel])
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const paletteTriggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useClickOutside(menuRef, () => setMenuOpen(false))
  const reduceMotion = useReducedMotion()

  const themeGlyph = useMemo(() => (theme === 'dark' ? '☾' : '☀'), [theme])
  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0], [activeTabId, tabs])

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemePreference(next)
    setResolvedTheme(next)
    trackEvent('theme_switched', { theme: next })
    setAnnouncement(`Theme switched to ${next} mode`)
  }, [setResolvedTheme, setThemePreference, theme])

  const exportDraft = useCallback(() => {
    const target = activeTab
    if (!target) return
    trackEvent('export_started')
    const safeTitle = (target.title || 'untitled')
      .trim()
      .replace(/[^\w\- ]+/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
    const blob = new Blob([target.snapshot.text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${safeTitle || 'untitled'}.txt`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
    trackEvent('export_completed')
    setAnnouncement(`Exported ${target.title || 'Untitled'} as text file`)
  }, [activeTab])

  const shortcutDispatcher = useCallback(
    (action: ShortcutAction) => {
      if (action === 'palette') {
        setPaletteOpen((open) => {
          const next = !open
          if (next) trackEvent('command_palette_opened')
          if (!next) {
            window.requestAnimationFrame(() => paletteTriggerRef.current?.focus())
          }
          return next
        })
        return
      }
      if (action === 'theme') {
        toggleTheme()
        return
      }
      if (action === 'rhymes') {
        toggleRhymePanel()
        setAnnouncement(panelVisible ? 'Rhyme panel hidden' : 'Rhyme panel shown')
        return
      }
      if (action === 'export') {
        exportDraft()
      }
    },
    [exportDraft, panelVisible, toggleRhymePanel, toggleTheme]
  )

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const key = event.key.toLowerCase()
      const hasPrimaryModifier = event.metaKey || event.ctrlKey
      if (!hasPrimaryModifier) return

      if (key === 'k') {
        event.preventDefault()
        shortcutDispatcher('palette')
      } else if (key === 'j') {
        event.preventDefault()
        shortcutDispatcher('theme')
      } else if (key === 's') {
        event.preventDefault()
        shortcutDispatcher('export')
      } else if (key === 'n') {
        event.preventDefault()
        newTab()
      } else if (key === 'b') {
        event.preventDefault()
        router.push('/')
      }
    }

    const handleEditorShortcut = (event: Event) => {
      const customEvent = event as CustomEvent<ShortcutAction>
      if (customEvent.detail === 'rhymeHighlightMode') return
      shortcutDispatcher(customEvent.detail)
    }

    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('rhyme:editor-shortcut', handleEditorShortcut as EventListener)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('rhyme:editor-shortcut', handleEditorShortcut as EventListener)
    }
  }, [newTab, router, shortcutDispatcher])

  const commandItems = useMemo<CommandPaletteItem[]>(() => {
    const base: CommandPaletteItem[] = [
      {
        id: 'new-draft',
        title: 'New Draft',
        description: 'Create and switch to a new draft',
        shortcutHint: '⌘/Ctrl N',
        keywords: ['new', 'create', 'project'],
        run: () => {
          trackEvent('draft_created', { source: 'command_palette' })
          newTab()
        },
      },
      {
        id: 'go-workspace',
        title: 'Go to Workspace',
        description: 'Return to writing launchpad',
        shortcutHint: '⌘/Ctrl B',
        keywords: ['workspace', 'dashboard', 'home'],
        run: () => {
          trackEvent('draft_opened', { source: 'command_palette_workspace' })
          router.push('/')
        },
      },
      {
        id: 'switch-theme',
        title: 'Switch Theme',
        description: 'Toggle dark/light theme',
        shortcutHint: '⌘/Ctrl J',
        keywords: ['theme', 'appearance', 'dark', 'light'],
        run: toggleTheme,
      },
      {
        id: 'export',
        title: 'Export Draft',
        description: 'Download current draft as .txt',
        shortcutHint: '⌘/Ctrl S',
        keywords: ['export', 'download', 'save'],
        run: exportDraft,
      },
      {
        id: 'settings',
        title: 'Open Settings',
        description: 'Open editor preferences',
        keywords: ['settings', 'preferences'],
        run: () => setSettingsOpen(true),
      },
      {
        id: 'toggle-rhymes',
        title: panelVisible ? 'Hide Rhyme Panel' : 'Show Rhyme Panel',
        description: 'Toggle rhyme assistance panel',
        shortcutHint: 'Alt R',
        keywords: ['rhyme', 'panel', 'assist'],
        run: toggleRhymePanel,
      },
      {
        id: densityMode === 'draft' ? 'analysis-mode' : 'draft-mode',
        title: densityMode === 'draft' ? 'Switch to Analysis Mode' : 'Switch to Draft Mode',
        description: 'Toggle editor display density',
        keywords: ['density', 'display', 'draft', 'analysis'],
        run: () => setDensityMode(densityMode === 'draft' ? 'analysis' : 'draft'),
      },
    ]

    const draftCommands: CommandPaletteItem[] = tabs
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((tab) => ({
        id: `open-${tab.id}`,
        title: `Open Draft: ${tab.title || 'Untitled'}`,
        description: 'Quick switch to this draft',
        keywords: ['open', 'switch', 'draft', tab.title || 'untitled'],
        run: () => {
          trackEvent('draft_opened', { source: 'command_palette_tab' })
          setActive(tab.id)
        },
      }))

    return [...base, ...draftCommands]
  }, [densityMode, exportDraft, newTab, panelVisible, router, setActive, setDensityMode, tabs, toggleRhymePanel, toggleTheme])

  return (
    <div className="ml-auto flex items-center gap-1.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              ref={paletteTriggerRef}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              className={buttonClass}
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              aria-keyshortcuts="Meta+K Control+K"
            >
              ⌘
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Command palette · ⌘/Ctrl + K</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              className={buttonClass}
              onClick={toggleTheme}
              aria-label="Toggle theme"
              aria-keyshortcuts="Meta+J Control+J"
            >
              {themeGlyph}
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Theme · ⌘/Ctrl + J</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              onClick={toggleRhymePanel}
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
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          onClick={() => setMenuOpen((open) => !open)}
          className={buttonClass}
          title="More actions"
          aria-label="More actions"
        >
          ⋯
        </motion.button>
        {menuOpen ? (
          <div
            className="absolute right-0 top-9 z-40 min-w-[220px] rounded-md border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-elevated)] p-1.5 shadow-2xl shadow-black/20"
          >
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between rounded px-2.5 py-2 text-left text-xs text-[color:var(--rl-shell-text)]/85 hover:bg-[color:color-mix(in_srgb,var(--rl-shell-text)_6%,transparent)]"
              onClick={() => {
                setShowRhymeDecorations(!showRhymeDecorations)
                setMenuOpen(false)
              }}
            >
              <span>Rhyme highlights</span>
              <span className="text-[color:var(--rl-shell-muted)]">{showRhymeDecorations ? 'On' : 'Off'}</span>
            </button>
            <button
              type="button"
              className="mt-1 flex w-full cursor-pointer items-center justify-between rounded border-t border-[color:var(--rl-shell-border)] px-2.5 py-2 text-left text-xs text-[color:var(--rl-shell-text)]/85 hover:bg-[color:color-mix(in_srgb,var(--rl-shell-text)_6%,transparent)]"
              onClick={() => {
                setMenuOpen(false)
                setSettingsOpen(true)
              }}
            >
              <span>Editor settings</span>
              <span className="text-[color:var(--rl-shell-muted)]">↗</span>
            </button>
          </div>
        ) : null}
      </div>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} hideTrigger />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={(next) => {
          setPaletteOpen(next)
          if (!next) {
            window.requestAnimationFrame(() => paletteTriggerRef.current?.focus())
          }
        }}
        onCommandRun={(command) => trackEvent('command_executed', { commandId: command.id })}
        commands={commandItems}
      />
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}
