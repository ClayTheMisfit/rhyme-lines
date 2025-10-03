'use client'

import { useState, useEffect, useRef } from 'react'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useRhymePanel } from '@/lib/state/rhymePanel'
import EditorSettings from './EditorSettings'

const THEME_KEY = 'rhyme-lines:theme'
const DOCUMENT_TITLE_KEY = 'rhyme-lines:document-title'

type SaveStatus = 'saved' | 'saving' | 'offline'

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

export default function TopBar() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [documentTitle, setDocumentTitle] = useState('Untitled Document')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  
  const titleInputRef = useRef<HTMLInputElement>(null)
  const { togglePanel, isOpen: isPanelOpen, activeTab, setActiveTab } = useRhymePanelStore()
  const { isOpen: panelVisible, isFloating, width: dockWidth, dock, undock, open: openPanel } = useRhymePanel((state) => ({
    isOpen: state.isOpen,
    isFloating: state.isFloating,
    width: state.width,
    dock: state.dock,
    undock: state.undock,
    open: state.open,
  }))

  // Load saved preferences
  useEffect(() => {
    const savedTheme = (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark'
    const savedTitle = localStorage.getItem(DOCUMENT_TITLE_KEY) || 'Untitled Document'
    
    setTheme(savedTheme)
    setDocumentTitle(savedTitle)
    applyTheme(savedTheme)
  }, [])

  // Listen for save events from editor
  useEffect(() => {
    const handleSaveStart = () => setSaveStatus('saving')
    const handleSaveComplete = () => {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('saved'), 2000) // Keep "saved" visible for 2s
    }
    const handleOffline = () => setSaveStatus('offline')

    window.addEventListener('rhyme:save-start', handleSaveStart)
    window.addEventListener('rhyme:save-complete', handleSaveComplete)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', () => setSaveStatus('saved'))

    return () => {
      window.removeEventListener('rhyme:save-start', handleSaveStart)
      window.removeEventListener('rhyme:save-complete', handleSaveComplete)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', () => setSaveStatus('saved'))
    }
  }, [])

  const handleTitleEdit = () => {
    setIsEditingTitle(true)
    setTimeout(() => titleInputRef.current?.focus(), 0)
  }

  const handleTitleSave = () => {
    setIsEditingTitle(false)
    localStorage.setItem(DOCUMENT_TITLE_KEY, documentTitle)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false)
      // Restore original title
      const savedTitle = localStorage.getItem(DOCUMENT_TITLE_KEY) || 'Untitled Document'
      setDocumentTitle(savedTitle)
    }
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem(THEME_KEY, next)
    applyTheme(next)
  }

  const toggleRhymeMode = () => {
    const next = activeTab === 'perfect' ? 'slant' : 'perfect'
    setActiveTab(next)
  }

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saving': return 'Saving...'
      case 'offline': return 'Offline'
      case 'saved': return 'Saved'
      default: return 'Saved'
    }
  }

  const getSaveStatusColor = () => {
    switch (saveStatus) {
      case 'saving': return 'text-yellow-400'
      case 'offline': return 'text-red-400'
      case 'saved': return 'text-green-400'
      default: return 'text-green-400'
    }
  }

  const dockedWidth = panelVisible && !isFloating ? Math.max(0, dockWidth) : 0
  const dockedOffset = panelVisible && !isFloating ? `calc(${Math.round(dockedWidth)}px + 1.5rem)` : '0px'
  const dockedWidthValue = panelVisible && !isFloating ? `calc(100% - ${Math.round(dockedWidth)}px - 1.5rem)` : '100%'

  const handleDockToggle = () => {
    if (!panelVisible) {
      openPanel()
    }
    if (isFloating) {
      dock()
    } else {
      undock()
    }
  }

  return (
    <div
      className="fixed top-0 left-0 h-12 bg-[#1e1e1e] border-b border-[#2c2c2c] z-50 flex items-center px-4 gap-2 sm:gap-4"
      style={{
        right: dockedOffset,
        width: isPanelOpen && !isFloating ? dockedWidthValue : '100%'
      }}
    >
      {/* Left: Document Title */}
      <div className="flex-1 min-w-0">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            className="bg-transparent text-[#d4d4d4] text-sm font-medium outline-none border-none w-full"
            style={{ fontFamily: 'inherit' }}
          />
        ) : (
          <button
            onClick={handleTitleEdit}
            className="text-[#d4d4d4] text-sm font-medium hover:text-white transition-colors text-left truncate"
          >
            {documentTitle}
          </button>
        )}
      </div>

      {/* Center: Save Status (hidden on mobile) */}
      <div className={`text-xs transition-opacity duration-300 ${getSaveStatusColor()} hidden sm:block`}>
        {getSaveStatusText()}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Rhyme Mode Toggle */}
        <button
          onClick={toggleRhymeMode}
          className={`text-sm font-medium transition-colors hover:text-white ${
            activeTab === 'perfect' ? 'text-white' : 'text-[#d4d4d4]'
          }`}
          title={`Rhyme mode: ${activeTab === 'perfect' ? 'Perfect' : 'Slant'}`}
        >
          {activeTab === 'perfect' ? '🎯' : '🎨'}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="text-sm font-medium text-[#d4d4d4] hover:text-white transition-colors"
          title="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Rhyme Panel Toggle */}
        <button
          onClick={togglePanel}
          className={`text-sm font-medium transition-colors ${
            isPanelOpen ? 'text-white' : 'text-[#d4d4d4] hover:text-white'
          }`}
          title="Toggle rhyme panel"
        >
          🎵
        </button>

        {/* Docking Toggle */}
        <button
          onClick={handleDockToggle}
          className="text-sm font-medium text-[#d4d4d4] hover:text-white transition-colors"
          title={isFloating ? 'Dock rhyme panel' : 'Undock rhyme panel'}
        >
          {isFloating ? '⇤' : '⧉'}
        </button>

        {/* Editor Settings */}
        <EditorSettings />
      </div>
    </div>
  )
}
