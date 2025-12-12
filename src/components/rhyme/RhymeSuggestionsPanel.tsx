'use client'

import * as React from 'react'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useRhymePanel, type RhymePanelMode, type SyllableFilter } from '@/lib/state/rhymePanel'
import { DockablePanel } from '@/components/panels/DockablePanel'
import { useRhymeSuggestions } from '@/hooks/useRhymeSuggestions'
import { countSyllables } from '@/lib/nlp/syllables'
import type { ActiveWord } from '@/lib/editor/getActiveWord'
import type { AggregatedSuggestion } from '@/lib/rhyme/aggregate'
import SuggestionItem from './SuggestionItem'
import { useSettingsStore } from '@/store/settingsStore'
import { shallow } from 'zustand/shallow'

const MIN_WIDTH = 280
const MAX_WIDTH = 640

const SYLLABLE_CHIPS: { label: string; value: SyllableFilter }[] = [
  { label: 'Any', value: 0 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5+', value: 5 },
]

type Props = {
  mode: RhymePanelMode
  onClose: () => void
  activeWord?: ActiveWord | null
}

function resolveSyllables(suggestion: AggregatedSuggestion): number {
  const raw = (suggestion as unknown as { syllableCount?: number }).syllableCount
  return (
    suggestion.syllables ??
    (typeof raw === 'number' ? raw : undefined) ??
    countSyllables(suggestion.word)
  )
}

function matchesFilter(suggestion: AggregatedSuggestion, filter: SyllableFilter): boolean {
  if (filter === 0) return true
  const syllableCount = resolveSyllables(suggestion)
  if (filter === 5) return syllableCount >= 5
  return syllableCount === filter
}

export const RhymeSuggestionsPanel = React.forwardRef<HTMLDivElement, Props>(
  ({ mode, onClose, activeWord }, forwardedRef) => {
    const searchRef = React.useRef<HTMLInputElement>(null)
    const suggestionsRef = React.useRef<AggregatedSuggestion[]>([])
    const panelRef = React.useRef<HTMLDivElement>(null)

    const setPanelRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        panelRef.current = node

        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef) {
          ;(forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        }
      },
      [forwardedRef]
    )

    const {
      activeTab,
      searchQuery,
      selectedIndex,
      setActiveTab,
      setSearchQuery,
      setSelectedIndex,
    } = useRhymePanelStore()

    const { filter, x, y, width, height, setFilter, setBounds, dock, undock } = useRhymePanel(
      (state) => ({
        filter: state.filter,
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
        setFilter: state.setFilter,
        setBounds: state.setBounds,
        dock: state.dock,
        undock: state.undock,
      })
    )

    const { rhymeAutoRefresh, debounceMode } = useSettingsStore(
      (state) => ({
        rhymeAutoRefresh: state.rhymeAutoRefresh,
        debounceMode: state.debounceMode,
      }),
      shallow
    )

  const {
    suggestions,
    isLoading,
    error,
    query: resolvedQuery,
    refetchSuggestions,
  } = useRhymeSuggestions({
    searchQuery,
    activeTab,
    activeWord: activeWord || null,
    enabled: mode !== 'hidden',
    autoRefresh: rhymeAutoRefresh,
    debounceMode,
  })

  const filteredSuggestions = React.useMemo(
    () => suggestions.filter((item) => matchesFilter(item, filter)),
    [suggestions, filter]
  )

  const canRefresh = React.useMemo(() => resolvedQuery.trim().length > 0, [resolvedQuery])

  React.useEffect(() => {
    suggestionsRef.current = filteredSuggestions
  }, [filteredSuggestions])

  React.useEffect(() => {
    if (filteredSuggestions.length === 0) {
      setSelectedIndex(null)
      return
    }

    if (selectedIndex == null || selectedIndex >= filteredSuggestions.length) {
      setSelectedIndex(0)
    }
  }, [filteredSuggestions.length, selectedIndex, setSelectedIndex])

  React.useEffect(() => {
    setSelectedIndex(filteredSuggestions.length > 0 ? 0 : null)
  }, [filter, filteredSuggestions.length, setSelectedIndex])

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

      range.setStartAfter(textNode)
      range.setEndAfter(textNode)
      selection.removeAllRanges()
      selection.addRange(range)
    } catch (err) {
      console.error('Failed to insert suggestion:', err)
    }
  }, [])

  const handleClose = React.useCallback(() => {
    onClose()
  }, [onClose])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (mode === 'hidden') return

      const target = event.target as HTMLElement | null
      if (panelRef.current && target && !panelRef.current.contains(target)) {
        return
      }

      const isTypingField =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)

      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key >= '0' && event.key <= '5') {
        if (isTypingField) return
        event.preventDefault()
        setFilter(Number(event.key) as SyllableFilter)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
        return
      }

      const suggestions = suggestionsRef.current
      if (suggestions.length === 0) return

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault()
          const next =
            selectedIndex == null
              ? 0
              : (selectedIndex + 1) % suggestions.length
          setSelectedIndex(next)
          return
        }
        case 'ArrowUp': {
          event.preventDefault()
          const next =
            selectedIndex == null
              ? suggestions.length - 1
              : (selectedIndex - 1 + suggestions.length) % suggestions.length
          setSelectedIndex(next)
          return
        }
        case 'Enter': {
          if (selectedIndex == null) return
          const suggestion = suggestions[selectedIndex]
          if (!suggestion) return
          event.preventDefault()
          insertSuggestion(suggestion)
          return
        }
        default:
          return
      }
    },
    [handleClose, insertSuggestion, mode, selectedIndex, setFilter, setSelectedIndex]
  )

  const isFloating = mode === 'detached'

  if (mode === 'hidden') return null

  const dockedWidth = Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH)

  const handleDockableClose = () => {
    handleClose()
  }

  const panelContent = (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-white/10 bg-slate-900/80 p-4">
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-blue-500 focus:outline-none"
        />

        <div className="flex items-center justify-between text-xs text-white/60">
          <span className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                rhymeAutoRefresh ? 'bg-white/10 text-white/80' : 'bg-amber-500/20 text-amber-100'
              }`}
            >
              {rhymeAutoRefresh ? 'Auto refresh on' : 'Manual refresh'}
            </span>
            {!rhymeAutoRefresh && (
              <span className="hidden sm:inline">Use refresh to pull the latest matches.</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => refetchSuggestions()}
            disabled={!canRefresh || isLoading}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-medium transition ${
              !canRefresh || isLoading
                ? 'cursor-not-allowed border-white/10 text-white/30'
                : 'border-white/20 text-white/80 hover:border-blue-400 hover:text-white'
            }`}
          >
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SYLLABLE_CHIPS.map((chip) => {
            const isActive = filter === chip.value
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setFilter(chip.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-500 text-white shadow'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
                aria-pressed={isActive}
              >
                {chip.label}
              </button>
            )
          })}
          <span className="text-[10px] uppercase tracking-wide text-white/40">keys 0–5</span>
        </div>

        <div className="flex gap-2 rounded-full bg-white/5 p-1 text-xs font-medium text-white/70">
          <button
            type="button"
            onClick={() => setActiveTab('perfect')}
            className={`flex-1 rounded-full px-3 py-1 transition-colors ${
              activeTab === 'perfect'
                ? 'bg-white/20 text-white shadow'
                : 'hover:bg-white/10'
            }`}
          >
            Perfect
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('slant')}
            className={`flex-1 rounded-full px-3 py-1 transition-colors ${
              activeTab === 'slant'
                ? 'bg-white/20 text-white shadow'
                : 'hover:bg-white/10'
            }`}
          >
            Slant
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 thin-scrollbar">
        {isLoading && (
          <div className="px-3 py-6 text-center text-sm text-white/50">
            Loading suggestions...
          </div>
        )}

        {error && (
          <div className="px-3 py-6 text-center text-sm text-red-300">
            Error loading suggestions: {error.message}
          </div>
        )}

        {!isLoading && !error && filteredSuggestions.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-white/50">
            No suggestions found
          </div>
        )}

        {!isLoading && !error && filteredSuggestions.length > 0 && (
          <div className="space-y-1">
            {filteredSuggestions.map((suggestion, index) => (
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

    const panelRootProps = {
      tabIndex: 0,
      onKeyDown: handleKeyDown,
      className: 'focus:outline-none',
      'data-testid': 'rhyme-panel-root',
    }

    const panel = (
      <DockablePanel
        title="Rhyme Suggestions"
        isFloating={isFloating}
        x={x}
        y={y}
        width={dockedWidth}
        height={height}
        onMoveResize={setBounds}
        onUndock={undock}
        onDock={dock}
        onClose={handleDockableClose}
        className="h-full w-full"
        panelRef={setPanelRef}
        panelProps={panelRootProps}
      >
        {panelContent}
      </DockablePanel>
    )

    if (isFloating) {
      return panel
    }

    return (
      <div
        data-testid="rhyme-panel"
        className="fixed bottom-6 right-6 z-40 flex flex-col"
        style={{
          width: `${dockedWidth}px`,
          top: 'calc(var(--header-height, 48px) + 0.5rem)',
        }}
      >
        {panel}
      </div>
    )
  }
)

RhymeSuggestionsPanel.displayName = 'RhymeSuggestionsPanel'
