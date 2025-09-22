'use client'

import * as React from "react"
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useRhymeSuggestions } from '@/hooks/useRhymeSuggestions'
import type { ActiveWord } from '@/lib/editor/getActiveWord'
import type { AggregatedSuggestion } from '@/lib/rhyme/aggregate'
import SuggestionItem from './SuggestionItem'

const MIN_WIDTH = 280
const MAX_WIDTH = 600
const DEFAULT_WIDTH = 320

type Props = {
  isOpen: boolean
  onClose: () => void
  activeWord?: ActiveWord | null
}

export function RhymeSuggestionsPanel({ isOpen, onClose, activeWord }: Props) {
  const searchRef = React.useRef<HTMLInputElement>(null)
  const suggestionsRef = React.useRef<AggregatedSuggestion[]>([])
  const [isResizing, setIsResizing] = React.useState(false)
  const {
    activeTab,
    searchQuery,
    selectedIndex,
    panelWidth,
    setActiveTab,
    setSearchQuery,
    setSelectedIndex,
    setPanelWidth,
  } = useRhymePanelStore()

  // Get rhyme suggestions
  const { suggestions, isLoading, error } = useRhymeSuggestions({
    searchQuery,
    activeTab,
    activeWord: activeWord || null,
    enabled: isOpen,
  })

  // Update suggestions ref
  React.useEffect(() => {
    suggestionsRef.current = suggestions
  }, [suggestions])

  // Insert suggestion into editor
  const insertSuggestion = React.useCallback((suggestion: { word: string }) => {
    const editorElement = document.getElementById('lyric-editor')
    if (!editorElement) return

    try {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      const textNode = document.createTextNode(suggestion.word)
      range.deleteContents()
      range.insertNode(textNode)
      
      // Move cursor after the inserted text
      range.setStartAfter(textNode)
      range.setEndAfter(textNode)
      selection.removeAllRanges()
      selection.addRange(range)

      // Keep panel open for side panel behavior
    } catch (error) {
      console.error('Failed to insert suggestion:', error)
    }
  }, [onClose])

  // Autofocus the search when the panel opens
  React.useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => searchRef.current?.focus())
    }
  }, [isOpen])

  // Handle keyboard navigation
  const handleKeyDown = React.useCallback((e: KeyboardEvent) => {
    if (!isOpen) return

    if (e.key === 'Escape') {
      onClose()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(Math.min(selectedIndex + 1, suggestionsRef.current.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(Math.max(selectedIndex - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestionsRef.current[selectedIndex]) {
        insertSuggestion(suggestionsRef.current[selectedIndex])
      }
    }
  }, [isOpen, selectedIndex, setSelectedIndex, onClose, insertSuggestion])

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Reset selection when suggestions change
  React.useEffect(() => {
    if (suggestions.length > 0 && selectedIndex >= suggestions.length) {
      setSelectedIndex(0)
    }
  }, [suggestions.length, selectedIndex, setSelectedIndex])

  // Resize handlers
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    const newWidth = window.innerWidth - e.clientX
    const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth))
    setPanelWidth(clampedWidth)
  }, [isResizing, setPanelWidth])

  const handleMouseUp = React.useCallback(() => {
    setIsResizing(false)
  }, [])

  // Add global mouse event listeners for resizing
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  if (!isOpen) return null

  return (
    <div className="fixed top-0 right-0 h-full shadow-xl flex flex-col z-40" style={{ 
      width: `${panelWidth}px`,
      background: 'linear-gradient(135deg, #2d1b3d 0%, #3a2a4a 50%, #44345C 100%)', 
      borderLeft: '1px solid #5a4a6c' 
    }}>
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors"
        onMouseDown={handleMouseDown}
        style={{ zIndex: 50 }}
      />
      {/* Header / Search / Tabs (sticky) */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 border-b" style={{ 
        background: 'linear-gradient(135deg, #2d1b3d 0%, #3a2a4a 50%, #44345C 100%)', 
        borderBottomColor: '#5a4a6c' 
      }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Rhyme Suggestions</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        <div className="mt-3">
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full rounded-md px-3 py-2 text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 border"
            style={{ backgroundColor: '#4a3a5a', borderColor: '#6b5b7c' }}
          />
        </div>

        <div className="mt-3">
          <div className="flex border-b" style={{ borderBottomColor: '#5a4a6c' }}>
            <button
              type="button"
              onClick={() => setActiveTab('perfect')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'perfect'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Perfect
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('slant')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'slant'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Slant
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable results area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain thin-scrollbar">
        {isLoading && (
          <div className="px-4 py-8 text-center text-gray-400">
            Loading suggestions...
          </div>
        )}
        
        {error && (
          <div className="px-4 py-8 text-center text-red-400">
            Error loading suggestions: {error.message}
          </div>
        )}
        
        {!isLoading && !error && suggestions.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400">
            No suggestions found
          </div>
        )}
        
        {!isLoading && !error && suggestions.length > 0 && (
          <div className="py-2">
            {suggestions.map((suggestion, index) => (
              <SuggestionItem
                key={`${suggestion.word}-${index}`}
                suggestion={suggestion}
                isSelected={index === selectedIndex}
                onClick={() => {
                  setSelectedIndex(index)
                  insertSuggestion(suggestion)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
