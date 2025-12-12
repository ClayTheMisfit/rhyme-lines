'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useMounted } from '@/hooks/useMounted'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import { useSettingsStore } from '@/store/settingsStore'
import SettingsSheet from './settings/SettingsSheet'

const DOCUMENT_TITLE_KEY = 'rhyme-lines:document-title'

const PANEL_SPACING_REM = '1.5rem'

type SaveStatus = 'saved' | 'saving' | 'offline'

function applyBodyTheme(theme: 'dark' | 'light') {
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
  const [documentTitle, setDocumentTitle] = useState('Untitled Document')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [isEditingTitle, setIsEditingTitle] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  const theme = useSettingsStore((state) => state.theme)
  const setThemePreference = useSettingsStore((state) => state.setTheme)

  const { resolvedTheme, setTheme: setResolvedTheme } = useTheme()

  const { togglePanel, activeTab, setActiveTab } = useRhymePanelStore()
  const { mode, width: dockWidth, dock, undock, setMode } = useRhymePanel((state) => ({
    mode: state.mode,
    width: state.width,
    dock: state.dock,
    undock: state.undock,
    setMode: state.setMode,
  }))
  const panelVisible = mode !== 'hidden'
  const isFloating = mode === 'detached'

  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    const measure = () => {
      const editorRoot = document.querySelector<HTMLElement>('.editor-root')
      if (!editorRoot) return false
      const computed = window.getComputedStyle(editorRoot)
      const paddingLeft = Number.parseFloat(computed.paddingLeft)
      if (Number.isFinite(paddingLeft)) {
        root.style.setProperty('--gutter-px', `${Math.round(paddingLeft)}px`)
      }
      return true
    }

    let observer: ResizeObserver | null = null
    const connectObserver = () => {
      if (observer || typeof ResizeObserver === 'undefined') return
      const editorRoot = document.querySelector<HTMLElement>('.editor-root')
      if (!editorRoot) return
      observer = new ResizeObserver(() => {
        window.requestAnimationFrame(measure)
      })
      observer.observe(editorRoot)
    }

    let rafId = 0
    let attempts = 0
    const MAX_ATTEMPTS = 30
    const attemptMeasure = () => {
      attempts += 1
      const found = measure()
      if (found) {
        connectObserver()
        return
      }
      if (attempts < MAX_ATTEMPTS) {
        rafId = window.requestAnimationFrame(attemptMeasure)
      }
    }

    rafId = window.requestAnimationFrame(attemptMeasure)

    return () => {
      window.cancelAnimationFrame(rafId)
      observer?.disconnect()
    }
  }, [mounted])

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
    
    // Set initial height
    updateHeight()
    
    const observer = new ResizeObserver(() => {
      updateHeight()
    })
    observer.observe(header)
    
    return () => observer.disconnect()
  }, [mounted])

  useEffect(() => {
    if (!mounted) return

    const savedTitle = localStorage.getItem(DOCUMENT_TITLE_KEY) || 'Untitled Document'
    setDocumentTitle(savedTitle)
  }, [mounted])

  useEffect(() => {
    if (!mounted) return undefined

    const handleSaveStart = () => setSaveStatus('saving')
    const handleSaveComplete = () => {
      setSaveStatus('saved')
      window.setTimeout(() => setSaveStatus('saved'), 2000)
    }
    const handleOffline = () => setSaveStatus('offline')
    const handleOnline = () => setSaveStatus('saved')

    window.addEventListener('rhyme:save-start', handleSaveStart)
    window.addEventListener('rhyme:save-complete', handleSaveComplete)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('rhyme:save-start', handleSaveStart)
      window.removeEventListener('rhyme:save-complete', handleSaveComplete)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
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
    const targetTheme = theme === 'dark' ? 'dark' : 'light'
    if (resolvedTheme !== targetTheme) {
      setResolvedTheme(targetTheme)
    }
  }, [mounted, resolvedTheme, setResolvedTheme, theme])

  const handleTitleEdit = () => {
    setIsEditingTitle(true)
    window.setTimeout(() => titleInputRef.current?.focus(), 0)
  }

  const handleTitleSave = () => {
    setIsEditingTitle(false)
    localStorage.setItem(DOCUMENT_TITLE_KEY, documentTitle)
  }

  const handleTitleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false)
      const savedTitle = localStorage.getItem(DOCUMENT_TITLE_KEY) || 'Untitled Document'
      setDocumentTitle(savedTitle)
    }
  }

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemePreference(next)
    setResolvedTheme(next)
  }, [setResolvedTheme, setThemePreference, theme])

  const toggleRhymeMode = () => {
    const next = activeTab === 'perfect' ? 'slant' : 'perfect'
    setActiveTab(next)
  }

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...'
      case 'offline':
        return 'Offline'
      case 'saved':
      default:
        return 'Saved'
    }
  }

  const getSaveStatusColor = () => {
    switch (saveStatus) {
      case 'saving':
        return 'text-yellow-400'
      case 'offline':
        return 'text-red-400'
      case 'saved':
      default:
        return 'text-green-400'
    }
  }

  const handleDockToggle = () => {
    if (!panelVisible) {
      setMode('docked')
      return
    }

    if (isFloating) {
      dock()
    } else {
      undock()
    }
  }

  return (
    <header
      ref={headerRef}
      data-testid="editor-header"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-2 bg-black/30 backdrop-blur-md border-b border-white/10 shadow-[0_1px_10px_rgba(255,255,255,0.05)] transition-all duration-300"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              className="bg-transparent text-sm font-semibold text-white/90 tracking-tight outline-none border-none w-full placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white/20"
              style={{ fontFamily: 'inherit' }}
            />
          ) : (
            <button
              onClick={handleTitleEdit}
              className="text-sm font-semibold text-white/80 hover:text-white/90 transition-colors text-left truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded"
            >
              {documentTitle}
            </button>
          )}
        </div>
        <span
          className={`text-xs font-mono transition-opacity duration-300 ${getSaveStatusColor()} ${saveStatus === 'saving' ? 'animate-pulse' : ''}`}
        >
          {getSaveStatusText()}
        </span>
      </div>

      <div className="flex items-center gap-3 text-white/70">
        <motion.button
          suppressHydrationWarning
          whileHover={{ scale: 1.15, rotate: 2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={toggleRhymeMode}
          className={`text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded ${
            activeTab === 'perfect' ? 'text-white' : 'text-white/70 hover:text-white/90'
          }`}
          title={`Rhyme mode: ${activeTab === 'perfect' ? 'Perfect' : 'Slant'}`}
        >
          {activeTab === 'perfect' ? '🎯' : '🎨'}
        </motion.button>

        <motion.button
          suppressHydrationWarning
          whileHover={{ scale: 1.15, rotate: 2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={toggleTheme}
          className="text-sm font-medium text-white/70 hover:text-white/90 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded"
          title="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </motion.button>

        <motion.button
          suppressHydrationWarning
          data-testid="toggle-rhyme-panel"
          whileHover={{ scale: 1.15, rotate: 2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={togglePanel}
          className={`text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded ${
            panelVisible ? 'text-white' : 'text-white/70 hover:text-white/90'
          }`}
          title="Toggle rhyme panel"
        >
          🎵
        </motion.button>

        <motion.button
          suppressHydrationWarning
          whileHover={{ scale: 1.15, rotate: 2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={handleDockToggle}
          className="text-sm font-medium text-white/70 hover:text-white/90 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded"
          title={isFloating ? 'Dock rhyme panel' : 'Undock rhyme panel'}
        >
          {isFloating ? '⇤' : '⧉'}
        </motion.button>

        <motion.div
          suppressHydrationWarning
          whileHover={{ scale: 1.15, rotate: 2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="flex"
        >
          <SettingsSheet />
        </motion.div>
      </div>
    </header>
  )
}
