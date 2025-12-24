'use client'

import * as React from 'react'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useRhymePanel, type RhymePanelMode, type SyllableFilter } from '@/lib/state/rhymePanel'
import { DockablePanel } from '@/components/panels/DockablePanel'
import { useRhymeSuggestions } from '@/hooks/useRhymeSuggestions'
import { countSyllables } from '@/lib/nlp/syllables'
import type { ActiveWord } from '@/lib/editor/getActiveWord'
import type { AggregatedSuggestion, RhymeQuality } from '@/lib/rhyme/aggregate'
import type { EditorHandle } from '@/components/Editor'
import SuggestionItem from './SuggestionItem'
import { useSettingsStore } from '@/store/settingsStore'
import { shallow } from 'zustand/shallow'

const MIN_WIDTH = 280
const MAX_WIDTH = 640
const MAX_VISIBLE_RESULTS = 30

const SYLLABLE_CHIPS: { label: string; value: SyllableFilter }[] = [
  { label: 'Any', value: 0 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5+', value: 5 },
]

const QUALITY_CHIPS: { label: string; value: RhymeQuality }[] = [
  { label: 'Perfect', value: 'perfect' },
  { label: 'Near', value: 'near' },
  { label: 'Slant', value: 'slant' },
]

type Props = {
  mode: RhymePanelMode
  onClose: () => void
  activeWord?: ActiveWord | null
  editorRef?: React.RefObject<EditorHandle | null>
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
  ({ mode, onClose, activeWord, editorRef }, forwardedRef) => {
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
      filters,
      searchQuery,
      selectedIndex,
      toggleFilter,
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

    const { rhymeAutoRefresh, debounceMode, setRhymeAutoRefresh } = useSettingsStore(
      (state) => ({
        rhymeAutoRefresh: state.rhymeAutoRefresh,
        debounceMode: state.debounceMode,
        setRhymeAutoRefresh: state.setRhymeAutoRefresh,
      }),
      shallow
    )

    const {
      suggestions,
      status,
      error,
      target,
      isOffline,
      refetchSuggestions,
    } = useRhymeSuggestions({
      searchQuery,
      filters,
      activeWord: activeWord || null,
      enabled: mode !== 'hidden',
      autoRefresh: rhymeAutoRefresh,
      debounceMode,
    })

    const [showAllResults, setShowAllResults] = React.useState(false)

    const filteredSuggestions = React.useMemo(
      () => suggestions.filter((item) => matchesFilter(item, filter)),
      [suggestions, filter]
    )

    const visibleSuggestions = React.useMemo(() => {
      if (showAllResults) return filteredSuggestions
      return filteredSuggestions.slice(0, MAX_VISIBLE_RESULTS)
    }, [filteredSuggestions, showAllResults])

    const canRefresh = React.useMemo(() => !!target?.word, [target])
    const isLoading = status === 'loading'

    React.useEffect(() => {
      suggestionsRef.current = visibleSuggestions
    }, [visibleSuggestions])

    React.useEffect(() => {
      if (visibleSuggestions.length === 0) {
        setSelectedIndex(null)
        return
      }

      if (selectedIndex == null || selectedIndex >= visibleSuggestions.length) {
        setSelectedIndex(0)
      }
    }, [selectedIndex, setSelectedIndex, visibleSuggestions.length])

    React.useEffect(() => {
      setSelectedIndex(visibleSuggestions.length > 0 ? 0 : null)
    }, [filter, setSelectedIndex, visibleSuggestions.length])

    React.useEffect(() => {
      if (filteredSuggestions.length <= MAX_VISIBLE_RESULTS) {
        setShowAllResults(false)
      }
    }, [filteredSuggestions.length])

    const insertSuggestion = React.useCallback(
      (suggestion: { word: string }) => {
        const editorApi = editorRef?.current
        if (editorApi?.insertText) {
          try {
            const result = editorApi.insertText(suggestion.word)
            if (!result) {
              console.warn('Editor insertion returned false; falling back to DOM insertion.')
            } else {
              return
            }
          } catch (err) {
            console.error('Failed to insert suggestion via editor API:', err)
          }
        }

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
      },
      [editorRef]
    )

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

    const handleSuggestionClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        const index = Number(event.currentTarget.dataset.index ?? 'NaN')
        if (!Number.isFinite(index)) return
        const suggestion = suggestionsRef.current[index]
        if (!suggestion) return
        setSelectedIndex(index)
        insertSuggestion(suggestion)
      },
      [insertSuggestion, setSelectedIndex]
    )

    const activeOptionId = selectedIndex != null ? `rhyme-suggestion-${selectedIndex}` : undefined

    const isFloating = mode === 'detached'

    if (mode === 'hidden') return null

    const dockedWidth = Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH)

    const handleDockableClose = () => {
      handleClose()
    }

  const panelContent = (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3">
        <div className="space-y-2 rounded-lg border border-slate-200/70 bg-slate-50/80 p-3 text-[12px] text-slate-600 shadow-sm dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-300">
          <div className="space-y-1.5">
            <label htmlFor="rhyme-search" className="sr-only">
              Search rhymes
            </label>
            <input
              ref={searchRef}
              id="rhyme-search"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search rhymes"
              className="w-full rounded-md border border-slate-200/70 bg-white/80 px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:ring-offset-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <button
              type="button"
              onClick={() => setRhymeAutoRefresh(!rhymeAutoRefresh)}
              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                rhymeAutoRefresh
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'
                  : 'border-slate-200/70 bg-white text-slate-500 hover:text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:text-slate-100'
              }`}
              aria-pressed={rhymeAutoRefresh}
            >
              Auto-refresh
            </button>
            <button
              type="button"
              onClick={() => refetchSuggestions()}
              disabled={!canRefresh || isLoading}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                !canRefresh || isLoading
                  ? 'cursor-not-allowed border-slate-200/60 text-slate-400 dark:border-slate-700/60 dark:text-slate-500'
                  : 'border-slate-200/80 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700/70 dark:text-slate-300 dark:hover:border-slate-500/80 dark:hover:text-slate-100'
              }`}
            >
              <span aria-hidden>⟳</span>
              Refresh
            </button>
            {isLoading && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="h-3 w-3 animate-spin rounded-full border border-slate-400/60 border-t-transparent motion-reduce:animate-none dark:border-slate-500/70" />
                Updating…
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {QUALITY_CHIPS.map((chip) => {
              const isActive = filters[chip.value]
              const activeClasses =
                chip.value === 'perfect'
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'
                  : chip.value === 'near'
                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-200'
                  : 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-200'
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => toggleFilter(chip.value)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                    isActive
                      ? activeClasses
                      : 'border-slate-200/70 bg-white text-slate-500 hover:text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:text-slate-100'
                  }`}
                  aria-pressed={isActive}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SYLLABLE_CHIPS.map((chip) => {
              const isActive = filter === chip.value
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setFilter(chip.value)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900'
                      : 'border-slate-200/70 bg-white text-slate-500 hover:text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:text-slate-100'
                  }`}
                  aria-pressed={isActive}
                >
                  {chip.label}
                </button>
              )
            })}
            <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              keys 0–5
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-2 pb-3 pt-0 thin-scrollbar">
        {isOffline && (
          <div className="px-3 py-2 text-center text-xs text-amber-500">
            Offline mode. Network providers paused; local/cache only.
          </div>
        )}

        {isLoading && (
          <div className="space-y-2 px-3 py-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="flex items-center justify-between rounded-lg border border-slate-200/60 bg-white/60 px-3 py-2 text-[13px] shadow-sm animate-pulse motion-reduce:animate-none dark:border-slate-700/60 dark:bg-slate-900/40"
              >
                <div className="h-4 w-32 rounded bg-slate-200/80 dark:bg-slate-700/60" />
                <div className="h-4 w-12 rounded bg-slate-200/80 dark:bg-slate-700/60" />
              </div>
            ))}
          </div>
        )}

        {status === 'idle' && !isLoading && (
          <div className="px-3 py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
            Type or move the caret to load rhymes.
          </div>
        )}

        {status === 'offline' && (
          <div className="px-3 py-6 text-center text-[13px] text-amber-500">
            Offline mode. Showing cached or local suggestions.
          </div>
        )}

        {error && (
          <div className="px-3 py-6 text-center text-[13px] text-rose-500">
            {status === 'error' ? 'Error loading suggestions: ' : 'Warning: '}
            {error}
          </div>
        )}

        {!isLoading && status !== 'idle' && filteredSuggestions.length === 0 && (
          <div className="px-3 py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
            No rhymes found — try Near or Slant
          </div>
        )}

        {!isLoading && visibleSuggestions.length > 0 && (
          <>
            <div role="listbox" aria-activedescendant={activeOptionId} aria-label="Rhyme suggestions" className="space-y-1">
              {visibleSuggestions.map((suggestion, index) => (
                <SuggestionItem
                  key={`${suggestion.word}-${index}`}
                  suggestion={suggestion}
                  isSelected={index === selectedIndex}
                  onClick={handleSuggestionClick}
                  index={index}
                  id={`rhyme-suggestion-${index}`}
                />
              ))}
            </div>
            {filteredSuggestions.length > MAX_VISIBLE_RESULTS && (
              <div className="px-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllResults((prev) => !prev)}
                  className="w-full rounded-md border border-slate-200/70 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-slate-500/80 dark:hover:text-slate-100 dark:focus-visible:ring-offset-slate-900"
                >
                  {showAllResults ? 'Show fewer' : `Show all (${filteredSuggestions.length})`}
                </button>
              </div>
            )}
          </>
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
        title="Rhymes"
        isFloating={isFloating}
        x={x}
        y={y}
        width={dockedWidth}
        height={height}
        onMoveResize={setBounds}
        onUndock={undock}
        onDock={dock}
        onClose={handleDockableClose}
        headerActions={
          <button
            type="button"
            onClick={() => refetchSuggestions()}
            disabled={!canRefresh || isLoading}
            aria-label="Refresh rhymes"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
              !canRefresh || isLoading
                ? 'cursor-not-allowed text-slate-400 dark:text-slate-500'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100'
            }`}
          >
            ⟳
          </button>
        }
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
