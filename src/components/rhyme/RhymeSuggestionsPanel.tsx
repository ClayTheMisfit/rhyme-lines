'use client'

import * as React from 'react'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useSettingsStore } from '@/store/settingsStore'
import { layers } from '@/lib/layers'
import { useRhymePanel, type RhymePanelMode } from '@/lib/state/rhymePanel'
import { DockablePanel } from '@/components/panels/DockablePanel'
import { useRhymeSuggestions } from '@/lib/rhyme-db/useRhymeSuggestions'
import type { Mode } from '@/lib/rhyme-db/queryRhymes'
import type { EditorHandle } from '@/components/Editor'
import { useState } from 'react'

const MIN_WIDTH = 280
const MAX_WIDTH = 640
const QUALITY_CHIPS: { label: string; value: Mode }[] = [
  { label: 'Perfect', value: 'perfect' },
  { label: 'Near', value: 'near' },
  { label: 'Slant', value: 'slant' },
]

type Props = {
  mode: RhymePanelMode
  onClose: () => void
  text: string
  caretIndex: number
  currentLineText: string
  editorRef?: React.RefObject<EditorHandle | null>
}

export const RhymeSuggestionsPanel = React.forwardRef<HTMLDivElement, Props>(
  ({ mode, onClose, text, caretIndex, currentLineText, editorRef }, forwardedRef) => {
    const searchRef = React.useRef<HTMLInputElement>(null)
    const suggestionsRef = React.useRef<string[]>([])
    const panelRef = React.useRef<HTMLDivElement>(null)
    const [activeTab, setActiveTab] = useState<'caret' | 'lineLast'>('caret')
    const [rhymeMode, setRhymeMode] = useState<Mode>('perfect')
    const [multiSyllable, setMultiSyllable] = useState(false)

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

    const { selectedIndex, setSelectedIndex } = useRhymePanelStore((state) => ({
      selectedIndex: state.selectedIndex,
      setSelectedIndex: state.setSelectedIndex,
    }))

    const { includeRareRhymes, setIncludeRareRhymes } = useSettingsStore((state) => ({
      includeRareRhymes: state.includeRareRhymes,
      setIncludeRareRhymes: state.setIncludeRareRhymes,
    }))

    const { x, y, width, height, setBounds, dock, undock } = useRhymePanel(
      (state) => ({
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
        setBounds: state.setBounds,
        dock: state.dock,
        undock: state.undock,
      })
    )

    const {
      status,
      error,
      results,
      debug,
    } = useRhymeSuggestions({
      text,
      caretIndex,
      currentLineText,
      mode: rhymeMode,
      max: 100,
      multiSyllable,
      includeRare: includeRareRhymes,
      enabled: mode !== 'hidden',
    })

    const caretSuggestions = results.caret ?? []
    const lineSuggestions = results.lineLast ?? []
    const activeSuggestions = activeTab === 'caret' ? caretSuggestions : lineSuggestions

    const caretToken = debug.caretToken
    const lineLastToken = debug.lineLastToken
    const activeToken = activeTab === 'caret' ? caretToken : lineLastToken
    const activeTokenLabel = activeTab === 'caret' ? 'Caret' : 'Line End'
    const isLoading = status === 'loading'
    const LIMITED_COMMON_THRESHOLD = 10

    React.useEffect(() => {
      suggestionsRef.current = activeSuggestions
    }, [activeSuggestions])

    React.useEffect(() => {
      if (activeSuggestions.length === 0) {
        setSelectedIndex(null)
        return
      }

      if (selectedIndex == null || selectedIndex >= activeSuggestions.length) {
        setSelectedIndex(0)
      }
    }, [activeSuggestions.length, selectedIndex, setSelectedIndex])

    const insertSuggestion = React.useCallback(
      (word: string) => {
        const editorApi = editorRef?.current
        if (editorApi?.insertText) {
          try {
            const result = editorApi.insertText(word)
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
          const textNode = document.createTextNode(word)
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
      [handleClose, insertSuggestion, mode, selectedIndex, setSelectedIndex]
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
                Rhyme panel focus
              </label>
              <input
                ref={searchRef}
                id="rhyme-search"
                type="text"
                value=""
                placeholder="Rhyme suggestions"
                readOnly
                className="w-full rounded-md border border-slate-200/70 bg-white/80 px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:ring-offset-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              {isLoading && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="h-3 w-3 animate-spin rounded-full border border-slate-400/60 border-t-transparent motion-reduce:animate-none dark:border-slate-500/70" />
                  Updating…
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {QUALITY_CHIPS.map((chip) => {
                const isActive = rhymeMode === chip.value
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
                    onClick={() => setRhymeMode(chip.value)}
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

            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 dark:border-slate-600 dark:bg-slate-900 dark:text-sky-400"
                  checked={multiSyllable}
                  onChange={(event) => setMultiSyllable(event.target.checked)}
                />
                <span>Multi-syllable (last 2)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 dark:border-slate-600 dark:bg-slate-900 dark:text-sky-400"
                  checked={includeRareRhymes}
                  onChange={(event) => setIncludeRareRhymes(event.target.checked)}
                />
                <span>Include rare words</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => setActiveTab('caret')}
                className={`rounded-full border px-3 py-1 font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                  activeTab === 'caret'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900'
                    : 'border-slate-200/70 bg-white text-slate-500 hover:text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:text-slate-100'
                }`}
              >
                Caret ({caretSuggestions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('lineLast')}
                className={`rounded-full border px-3 py-1 font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                  activeTab === 'lineLast'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900'
                    : 'border-slate-200/70 bg-white text-slate-500 hover:text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:text-slate-100'
                }`}
              >
                Line End ({lineSuggestions.length})
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto px-2 pb-3 pt-0 thin-scrollbar">
          {!isLoading && (
            <div className="px-3 pb-2 text-[12px] text-slate-500 dark:text-slate-400">
              {activeTokenLabel}: {activeToken ? `"${activeToken}"` : '—'}
            </div>
          )}

          {!isLoading && !includeRareRhymes && status !== 'idle' && activeSuggestions.length > 0 &&
            activeSuggestions.length < LIMITED_COMMON_THRESHOLD && (
              <div className="px-3 pb-2 text-[11px] text-slate-400 dark:text-slate-500">
                Limited common matches — try Near/Slant or enable Rare words for more.
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

          {error && (
            <div className="px-3 py-6 text-center text-[13px] text-rose-500">
              {status === 'error' ? 'Error loading suggestions: ' : 'Warning: '} {error}
              <div className="mt-2 text-[12px] text-rose-400">
                Details: {error}
              </div>
              <div className="mt-2 text-[12px] text-rose-400">
                Verify public/rhyme-db/rhyme-db.v2.json exists (npm run build:rhyme-db).
              </div>
            </div>
          )}

          {!isLoading && status !== 'idle' && activeSuggestions.length === 0 && (
            <div className="px-3 py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
              {includeRareRhymes
                ? 'No rhymes found — try Near or Slant'
                : 'No common perfect rhymes — try Near/Slant or enable Rare words.'}
            </div>
          )}

          {!isLoading && activeSuggestions.length > 0 && (
            <div
              role="listbox"
              aria-activedescendant={activeOptionId}
              aria-label="Rhyme suggestions"
              className="space-y-1"
            >
              {activeSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion}-${index}`}
                  type="button"
                  onClick={handleSuggestionClick}
                  role="option"
                  aria-selected={index === selectedIndex}
                  data-index={index}
                  id={`rhyme-suggestion-${index}`}
                  className={`relative w-full rounded-lg border border-transparent px-3 py-2 text-left text-[13px] transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                    index === selectedIndex
                      ? 'border-sky-500/40 bg-sky-500/10 shadow-sm dark:border-sky-400/40 dark:bg-sky-400/10'
                      : 'hover:bg-slate-100/70 active:bg-slate-200/60 dark:hover:bg-white/5 dark:active:bg-white/10'
                  } ${index === selectedIndex ? "before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-sky-500 before:content-['']" : ''}`}
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {suggestion}
                  </span>
                </button>
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
        className="fixed bottom-6 right-6 flex flex-col"
        style={{
          zIndex: layers.rhymePanel,
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
