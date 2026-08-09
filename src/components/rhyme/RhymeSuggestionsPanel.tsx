'use client'

import * as React from 'react'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useSettingsStore } from '@/store/settingsStore'
import { layers } from '@/lib/layers'
import { useRhymePanel, type RhymePanelMode } from '@/lib/state/rhymePanel'
import { DockablePanel } from '@/components/panels/DockablePanel'
import { useRhymeSuggestions } from '@/lib/rhyme-db/useRhymeSuggestions'
import type { RhymeFilters } from '@/lib/persist/schema'
import type { EditorHandle } from '@/components/Editor'
import { getLocalInitFailureReason } from '@/lib/rhymes/rhymeSource'
import { useMemo, useState } from 'react'
import { shallow } from 'zustand/shallow'
import { normalizeToken } from '@/lib/rhyme-db/normalizeToken'
import { buildVisibleSuggestions } from '@/components/rhyme/buildVisibleSuggestions'
import { estimateSyllables } from '@/lib/nlp/estimateSyllables'
import { trackEvent } from '@/lib/analytics/events'
import { RhymeThesaurusSection } from '@/components/rhyme/RhymeThesaurusSection'
import type { RhymeTargetRange } from '@/lib/editor/rhymeReplacement'

const MIN_WIDTH = 280
const MAX_WIDTH = 640
const QUICK_ASSIST_LIMIT = 6
const PANEL_RESULTS_LIMIT = 40
type QualityKey = keyof RhymeFilters
type PanelAnchorRect = { top: number; left: number; width: number; height: number }

const FILTER_MODES = ['all', 'perfect', 'near', 'slant'] as const

type Props = {
  mode: RhymePanelMode
  onClose: () => void
  text: string
  caretIndex: number
  currentLineText: string
  activeLineRect?: PanelAnchorRect | null
  editorLaneRect?: PanelAnchorRect | null
  editorRef?: React.RefObject<EditorHandle | null>
  targetRange?: RhymeTargetRange | null
}

export const RhymeSuggestionsPanel = React.forwardRef<HTMLDivElement, Props>(
  ({ mode, onClose, text, caretIndex, currentLineText, editorRef, targetRange }, forwardedRef) => {
    const searchRef = React.useRef<HTMLInputElement>(null)
    const suggestionsRef = React.useRef<string[]>([])
    const panelRef = React.useRef<HTMLDivElement>(null)
    const [activeTab, setActiveTab] = useState<'caret' | 'lineLast'>('caret')

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
      selectedIndex,
      setSelectedIndex,
      searchQuery,
      setSearchQuery,
      multiSyllablePerfect,
      setMultiSyllablePerfect,
      rhymeSuggestionMode,
      setRhymeSuggestionMode,
    } = useRhymePanelStore((state) => ({
      selectedIndex: state.selectedIndex,
      setSelectedIndex: state.setSelectedIndex,
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      multiSyllablePerfect: state.multiSyllablePerfect,
      setMultiSyllablePerfect: state.setMultiSyllablePerfect,
      rhymeSuggestionMode: state.rhymeSuggestionMode,
      setRhymeSuggestionMode: state.setRhymeSuggestionMode,
    }))

    const [advancedOpen, setAdvancedOpen] = useState(false)
    const [debugEnabled, setDebugEnabled] = useState(false)
    const [debouncedQuery, setDebouncedQuery] = useState(searchQuery)

    const {
      commonWordsOnly,
      setCommonWordsOnly,
      rhymeFilters,
      setRhymeFilters,
    } = useSettingsStore((state) => ({
      commonWordsOnly: state.commonWordsOnly,
      setCommonWordsOnly: state.setCommonWordsOnly,
      rhymeFilters: state.rhymeFilters,
      setRhymeFilters: state.setRhymeFilters,
    }), shallow)

    const { x, y, width, height, setBounds, dock, undock, setMode } = useRhymePanel(
      (state) => ({
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
        setBounds: state.setBounds,
        dock: state.dock,
        undock: state.undock,
        setMode: state.setMode,
      })
    )

    const resolvedModes = useMemo<QualityKey[]>(
      () => rhymeSuggestionMode === 'perfect' ? ['perfect'] : ['perfect', 'near'],
      [rhymeSuggestionMode]
    )

    const normalizedQueryToken = useMemo(() => normalizeToken(debouncedQuery), [debouncedQuery])
    const isQueryActive = Boolean(normalizedQueryToken)
    const shouldFetchSuggestions = mode !== 'hidden' || !isQueryActive

    const {
      status,
      error,
      warning,
      results,
      debug,
      rhymeDebug,
      meta,
      phase,
      activeTokens,
    } = useRhymeSuggestions({
      text,
      caretIndex,
      currentLineText,
      queryToken: debouncedQuery,
      modes: resolvedModes,
      max: undefined,
      multiSyllable: multiSyllablePerfect,
      commonWordsOnly,
      debug: debugEnabled,
      enabled: shouldFetchSuggestions,
    })

    const caretSuggestions = results.caret ?? []
    const lineSuggestions = results.lineLast ?? []
    const activeSuggestions = isQueryActive
      ? (results.caret ?? results.lineLast ?? [])
      : activeTab === 'caret'
        ? caretSuggestions
        : lineSuggestions
    const visibleSuggestions = useMemo(
      () => buildVisibleSuggestions(activeSuggestions, { limit: PANEL_RESULTS_LIMIT }),
      [activeSuggestions]
    )
    const quickAssistSuggestions = useMemo(
      () => buildVisibleSuggestions(activeSuggestions, { limit: QUICK_ASSIST_LIMIT }),
      [activeSuggestions]
    )

    const caretToken = activeTokens.caretToken ?? debug.caretDetails?.normalizedToken ?? debug.caretToken
    const lineLastToken = activeTokens.lineLastToken ?? debug.lineLastDetails?.normalizedToken ?? debug.lineLastToken
    const activeToken = isQueryActive ? normalizedQueryToken : activeTab === 'caret' ? caretToken : lineLastToken
    const activeTokenLabel = isQueryActive ? 'Query' : activeTab === 'caret' ? 'Caret' : 'Line End'
    const activeDebug = useMemo(() => (
      isQueryActive
        ? debug.caretDetails ?? debug.lineLastDetails
        : activeTab === 'caret'
          ? debug.caretDetails
          : debug.lineLastDetails
    ), [activeTab, debug.caretDetails, debug.lineLastDetails, isQueryActive])
    const isInitialLoading = phase === 'initial'
    const isRefreshing = phase === 'refreshing'
    const localInitFailureReason = getLocalInitFailureReason()
    const totalAvailable = activeDebug?.afterModeMatchCount ?? activeSuggestions.length
    const filteredCount = visibleSuggestions.length
    const isFiltered = totalAvailable > filteredCount
    const activePanelDebug = useMemo(() => {
      if (!debugEnabled) return undefined
      const base = isQueryActive
        ? rhymeDebug.caret ?? rhymeDebug.lineLast
        : activeTab === 'caret'
          ? rhymeDebug.caret
          : rhymeDebug.lineLast
      if (!base) return undefined
      const stageCounts = { ...base.stageCounts }
      stageCounts.afterCap = visibleSuggestions.length
      const rejections = { ...base.rejections }
      const capApplied = activeSuggestions.length > visibleSuggestions.length
      let cap = base.cap
      if (capApplied) {
        rejections.cap_slice = (rejections.cap_slice ?? 0) + (activeSuggestions.length - visibleSuggestions.length)
        cap = { applied: true, limit: visibleSuggestions.length, stage: 'ui_slice' }
      }
      return {
        ...base,
        filteredCount: visibleSuggestions.length,
        renderedCount: visibleSuggestions.length,
        stageCounts,
        rejections,
        cap,
      }
    }, [activeSuggestions.length, activeTab, debugEnabled, isQueryActive, rhymeDebug, visibleSuggestions.length])

    React.useEffect(() => {
      suggestionsRef.current = visibleSuggestions
    }, [visibleSuggestions])

    const resultsKey = useMemo(
      () => [
        activeTokenLabel,
        activeToken ?? '',
        resolvedModes.join(','),
        commonWordsOnly,
        multiSyllablePerfect,
        activeTab,
        isQueryActive,
      ].join('|'),
      [
        activeTab,
        activeToken,
        activeTokenLabel,
        commonWordsOnly,
        isQueryActive,
        multiSyllablePerfect,
        resolvedModes,
      ]
    )

    React.useEffect(() => {
      if (process.env.NODE_ENV === 'production') return
      console.log('[rhymes] pools', {
        token: activeToken,
        poolPerfect: activeDebug?.candidatePools.perfect ?? null,
        poolNear: activeDebug?.candidatePools.near ?? null,
      })
      console.log('[rhymes] resultsTotal', { token: activeToken, resultsTotal: totalAvailable })
      console.log('[rhymes] render', {
        token: activeToken,
        resultsTotal: totalAvailable,
        rendered: filteredCount,
      })
    }, [activeDebug?.candidatePools.near, activeDebug?.candidatePools.perfect, activeToken, filteredCount, totalAvailable])

    React.useEffect(() => {
      if (process.env.NODE_ENV === 'production') return
      const searchParams = new URLSearchParams(window.location.search)
      const enabled = searchParams.get('rhymeDebug') === '1' || window.localStorage.getItem('rhymeDebug') === '1'
      setDebugEnabled(enabled)
    }, [])

    React.useEffect(() => {
      if (debouncedQuery === searchQuery) return
      const timer = window.setTimeout(() => {
        setDebouncedQuery(searchQuery)
      }, 200)
      return () => {
        window.clearTimeout(timer)
      }
    }, [debouncedQuery, searchQuery])

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
      if (selectedIndex == null) return
      if (selectedIndex < visibleSuggestions.length) return
      setSelectedIndex(0)
    }, [selectedIndex, setSelectedIndex, visibleSuggestions.length])

    const insertSuggestion = React.useCallback(
      (word: string) => {
        const editorApi = editorRef?.current
        if (editorApi?.insertText) {
          try {
            const result = targetRange
              ? editorApi.replaceRhymeTarget(word, targetRange)
              : editorApi.insertText(word)
            if (!result) {
              if (targetRange) {
                editorApi.focus()
                return
              }
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
      [editorRef, targetRange]
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

        const shortcutIgnored = Boolean(target?.closest('[data-rhyme-panel-shortcuts="ignore"], [role="group"]'))
        if (shortcutIgnored && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
          return
        }

        const suggestions = suggestionsRef.current
        if (suggestions.length === 0) return

        const focusSuggestion = (index: number) => {
          setSelectedIndex(index)
          panelRef.current?.querySelector<HTMLElement>(`#rhyme-suggestion-${index}`)?.focus()
        }
        switch (event.key) {
          case 'ArrowDown':
          case 'ArrowRight': {
            event.preventDefault()
            const next =
              selectedIndex == null
                ? 0
                : (selectedIndex + 1) % suggestions.length
            focusSuggestion(next)
            return
          }
          case 'ArrowUp':
          case 'ArrowLeft': {
            event.preventDefault()
            const next =
              selectedIndex == null
                ? suggestions.length - 1
                : (selectedIndex - 1 + suggestions.length) % suggestions.length
            focusSuggestion(next)
            return
          }
          case 'Home': {
            event.preventDefault()
            focusSuggestion(0)
            return
          }
          case 'End': {
            event.preventDefault()
            focusSuggestion(suggestions.length - 1)
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
    const handleOpenPanelFromAssist = React.useCallback(() => {
      setMode('docked')
    }, [setMode])

    const activeOptionId = selectedIndex != null ? `rhyme-suggestion-${selectedIndex}` : undefined

    const isFloating = mode === 'detached'

    if (mode === 'hidden') {
      const showQuickAssist =
        !isQueryActive &&
        !isInitialLoading &&
        quickAssistSuggestions.length > 0 &&
        Boolean(activeToken)

      if (!showQuickAssist) return null

      return (
        <div
          data-testid="rhyme-quick-assist"
          className="pointer-events-none fixed bottom-6 right-6 z-40 w-[min(460px,calc(100vw-2rem))]"
        >
          <div className="pointer-events-auto rounded-lg border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-chrome)]/95 p-3 shadow-lg shadow-black/12 backdrop-blur-[1px]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] tracking-[0.08em] text-[color:var(--rl-shell-muted)]">
                Rhymes for <span className="font-semibold text-[color:var(--rl-shell-text)]">“{activeToken}”</span>
              </p>
              <button
                type="button"
                onClick={handleOpenPanelFromAssist}
                aria-expanded="false"
                aria-controls="rhyme-expanded-panel"
                className="cursor-pointer rounded-sm px-2 py-1 text-[11px] font-medium text-[color:var(--rl-shell-muted)] transition-colors hover:text-[color:var(--rl-shell-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d000]/45"
              >
                See more
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickAssistSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion}-${index}`}
                  type="button"
                  onClick={() => insertSuggestion(suggestion)}
                  className="cursor-pointer rounded-full border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-elevated)] px-2.5 py-1 text-[12px] text-[color:var(--rl-shell-text)] transition-colors hover:border-[#f2d000]/35 hover:bg-[#f2d000]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d000]/45"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    }

    const dockedWidth = Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH)

    const handleDockableClose = () => {
      handleClose()
    }

    const panelContent = (
      <div className="flex h-full min-h-0 flex-col">
        <div className="px-2.5 pt-2.5">
          <div className="space-y-2.5 rounded-md border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-elevated)] p-2.5 text-[12px] text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/70">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">
              Rhymes
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rhyme-search" className="sr-only">
                Type a word to get rhymes
              </label>
              <input
                ref={searchRef}
                id="rhyme-search"
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Type a word…"
                className="w-full rounded-sm border border-[color:var(--rl-shell-border)] bg-[#f3f5f7] px-3 py-2 text-[13px] text-slate-900 placeholder:text-[#7b8794] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--rl-shell-elevated)] motion-reduce:transition-none dark:border-white/[0.1] dark:bg-[#0d0d0f] dark:text-white/90 dark:placeholder:text-white/35 dark:focus-visible:ring-white/25 dark:focus-visible:ring-offset-[#111113]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              {isRefreshing && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="h-3 w-3 animate-spin rounded-full border border-slate-400/60 border-t-transparent motion-reduce:animate-none dark:border-slate-500/70" />
                  Updating…
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Rhyme type">
              {FILTER_MODES.map((filterMode) => {
                const isActive = rhymeSuggestionMode === filterMode
                const label = filterMode.charAt(0).toUpperCase() + filterMode.slice(1)
                return (
                  <button
                    key={filterMode}
                    type="button"
                    onClick={() => {
                      setRhymeSuggestionMode(filterMode)
                      const next = filterMode === 'perfect'
                        ? { perfect: true, near: false }
                        : { perfect: true, near: true }
                      setRhymeFilters(next)
                      trackEvent('rhyme_filter_changed', { quality: filterMode })
                    }}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d000]/45 ${
                      isActive
                        ? 'border-[#f2d000]/45 bg-[#f2d000]/12 text-[color:var(--rl-shell-text)]'
                        : 'border-[color:var(--rl-shell-border)] text-[color:var(--rl-shell-muted)] hover:text-[color:var(--rl-shell-text)]'
                    }`}
                    aria-pressed={isActive}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAdvancedOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:text-white/55 dark:hover:text-white/82 dark:focus-visible:ring-white/25 dark:focus-visible:ring-offset-[#111113]"
                aria-expanded={advancedOpen}
                aria-controls="rhyme-advanced"
              >
                Advanced
                <span className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {isQueryActive && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Clear input to use caret/line targets
                </span>
              )}
            </div>

            {advancedOpen && (
              <div id="rhyme-advanced" className="space-y-3 rounded-sm border border-[color:var(--rl-shell-border)] bg-[#eef2f5] p-2 text-[11px] text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/55">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/45 dark:border-white/[0.2] dark:bg-[#0d0d0f] dark:text-white/85 dark:focus-visible:ring-white/25"
                    checked={multiSyllablePerfect}
                    onChange={(event) => {
                      trackEvent('rhyme_filter_changed', { quality: 'multi_syllable_perfect', enabled: event.target.checked })
                      setMultiSyllablePerfect(event.target.checked)
                    }}
                  />
                  <span className="space-y-1">
                    <span className="block text-slate-600 dark:text-slate-300">Multi-syllable perfect rhymes</span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                      Match the last two syllables (tighter rhymes).
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/45 dark:border-white/[0.2] dark:bg-[#0d0d0f] dark:text-white/85 dark:focus-visible:ring-white/25"
                    checked={commonWordsOnly}
                    onChange={(event) => {
                      trackEvent('rhyme_filter_changed', { quality: 'common_words_only', enabled: event.target.checked })
                      setCommonWordsOnly(event.target.checked)
                    }}
                  />
                  <span className="space-y-1">
                    <span className="block text-slate-600 dark:text-slate-300">Common words only</span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                      Hide rare/archaic words. (Most RB-like)
                    </span>
                  </span>
                </label>

                {!isQueryActive && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setActiveTab('caret')}
                      className={`rounded-full border px-3 py-1 font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-white/25 dark:focus-visible:ring-offset-[#111113] ${
                        activeTab === 'caret'
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-white/[0.2] dark:bg-white/[0.14] dark:text-white'
                          : 'border-[color:var(--rl-shell-border)] bg-[#eef2f5] text-slate-700 hover:text-slate-900 dark:border-white/[0.1] dark:bg-[#0d0d0f] dark:text-white/58 dark:hover:text-white/88'
                      }`}
                    >
                      Caret ({caretSuggestions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('lineLast')}
                      className={`rounded-full border px-3 py-1 font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-white/25 dark:focus-visible:ring-offset-[#111113] ${
                        activeTab === 'lineLast'
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-white/[0.2] dark:bg-white/[0.14] dark:text-white'
                          : 'border-[color:var(--rl-shell-border)] bg-[#eef2f5] text-slate-700 hover:text-slate-900 dark:border-white/[0.1] dark:bg-[#0d0d0f] dark:text-white/58 dark:hover:text-white/88'
                      }`}
                    >
                      Line End ({lineSuggestions.length})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-0 thin-scrollbar">
          {!isInitialLoading && (
            <div className="sticky top-0 z-10 mb-1 rounded-md border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-elevated)]/95 px-3 py-2 text-[12px] backdrop-blur-[1px]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {activeTokenLabel}
                </p>
                {isFiltered ? (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {filteredCount} of {totalAvailable}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{totalAvailable} results</p>
                )}
              </div>
              <h2 id="rhyme-panel-target" className="mt-1 text-[14px] font-semibold text-slate-900 dark:text-white/90">
                Rhymes for “{activeToken ?? '—'}”
              </h2>
            </div>
          )}

          {!isInitialLoading && activeTab === 'caret' && debug.caretDetails && (
            <div className="px-3 pb-2 text-[11px] text-slate-400 dark:text-slate-500">
              Token: {debug.caretDetails.normalizedToken} · id: {debug.caretDetails.wordId ?? '—'} ·
              perfect: {debug.caretDetails.perfectKey ?? '—'} · vowel: {debug.caretDetails.vowelKey ?? '—'} ·
              coda: {debug.caretDetails.codaKey ?? '—'} · pools (P/N):{' '}
              {debug.caretDetails.candidatePools.perfect}/
              {debug.caretDetails.candidatePools.near}
            </div>
          )}

          {process.env.NODE_ENV !== 'production' && !isInitialLoading && (() => {
            if (!activeDebug) return null
            return (
              <div className="px-3 pb-2 text-[10px] text-slate-400 dark:text-slate-500">
                tail: {activeDebug.perfectTailLenUsed ?? '—'} · pool: {activeDebug.poolSize ?? '—'} ·
                after mode: {activeDebug.afterModeMatchCount ?? '—'} ·
                after common-only: {activeDebug.stageCounts?.afterCommonOnly ?? '—'} ·
                after rare: {activeDebug.afterRareRankOrFilterCount ?? '—'} ·
                rendered: {activeDebug.renderedCount ?? visibleSuggestions.length} · visible: {visibleSuggestions.length}
                {activeDebug.tierCounts && (
                  <span>
                    {' '}
                    · tiers: c{activeDebug.tierCounts.common}/u{activeDebug.tierCounts.uncommon}/r{activeDebug.tierCounts.rare}/p{activeDebug.tierCounts.proper}/f{activeDebug.tierCounts.foreign}/w{activeDebug.tierCounts.weird}
                  </span>
                )}
                {activeDebug.vowelPoolSize != null && activeDebug.codaPoolSize != null && (
                  <span>
                    {' '}
                    · vowel pool: {activeDebug.vowelPoolSize} · coda pool: {activeDebug.codaPoolSize} · combined:{' '}
                    {activeDebug.combinedUniqueCount ?? '—'}
                  </span>
                )}
                {activeDebug.topCandidates && activeDebug.topCandidates.length > 0 && (
                  <div className="mt-1 space-y-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                    {activeDebug.topCandidates.map((entry) => (
                      <div key={`${entry.word}-${entry.tier}`}>
                        {entry.word} · {entry.tier} · {entry.score}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {!isInitialLoading && (
            <RhymeThesaurusSection
              target={activeToken}
              modes={resolvedModes}
              commonWordsOnly={commonWordsOnly}
              multiSyllable={multiSyllablePerfect}
              panelMode={mode}
              onInsertRhyme={insertSuggestion}
            />
          )}

          {warning && !isInitialLoading && (
            <div className="px-3 pb-2 text-[11px] text-amber-600 dark:text-amber-400">
              {warning}
            </div>
          )}

          {meta.source === 'online' && localInitFailureReason && !isInitialLoading && (
            <div className="px-3 pb-2 text-[11px] text-slate-500 dark:text-slate-400">
              {meta.note ?? 'Offline DB unavailable — using online providers.'}
            </div>
          )}

          {isInitialLoading && (
            <div className="space-y-2 px-3 py-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="flex animate-pulse items-center justify-between rounded-md border border-[color:var(--rl-shell-border)] bg-[#eef2f5] px-3 py-2 text-[13px] motion-reduce:animate-none dark:border-white/[0.08] dark:bg-white/[0.03]"
                >
                  <div className="h-4 w-32 rounded bg-slate-200/80 dark:bg-slate-700/60" />
                  <div className="h-4 w-12 rounded bg-slate-200/80 dark:bg-slate-700/60" />
                </div>
              ))}
            </div>
          )}

          {status === 'idle' && !isInitialLoading && (
            <div className="px-3 py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
              Type a word or move the caret to load rhymes.
            </div>
          )}

          {error && (
            <div className="px-3 py-5 text-center text-[13px] text-slate-600 dark:text-slate-300">
              <p>{status === 'error' ? 'Couldn’t refresh rhymes right now.' : 'Rhyme warning.'}</p>
              <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{error}</div>
              {meta.source === 'local' && (
                <div className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
                  Verify public/rhyme-db/rhyme-db.v2.json exists (npm run build:rhyme-db).
                </div>
              )}
            </div>
          )}

          {!isInitialLoading && status !== 'idle' && status !== 'loading' && visibleSuggestions.length === 0 && (
            <div className="px-3 py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
              {totalAvailable > 0
                ? 'Filtered out by current controls. Try disabling “Common words only” or enabling Near / Slant.'
                : 'No strong matches yet. Try Near / Slant.'}
            </div>
          )}

          {!isInitialLoading && visibleSuggestions.length > 0 && (
            <div
              role="listbox"
              aria-activedescendant={activeOptionId}
              aria-label="Rhyme suggestions"
              className="space-y-1"
            >
              {visibleSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion}-${index}`}
                  type="button"
                  onClick={handleSuggestionClick}
                  role="option"
                  aria-selected={index === selectedIndex}
                  data-index={index}
                  id={`rhyme-suggestion-${index}`}
                  className={`relative w-full rounded-md border border-transparent px-3 py-2 text-left text-[13px] transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-white/25 dark:focus-visible:ring-offset-[#101012] ${
                    index === selectedIndex
                      ? 'border-slate-300/80 bg-slate-200/55 shadow-sm dark:border-white/[0.18] dark:bg-white/[0.1]'
                      : 'hover:bg-slate-100/80 active:bg-slate-200/70 dark:hover:bg-white/[0.05] dark:active:bg-white/[0.08]'
                  } ${index === selectedIndex ? "before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-slate-500/80 before:content-[''] dark:before:bg-white/55" : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block truncate font-medium text-slate-900 dark:text-white/88">{suggestion}</span>
                      <span className="block text-[10px] uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
                        {rhymeFilters.perfect && !rhymeFilters.near
                          ? 'Perfect'
                          : rhymeFilters.near && !rhymeFilters.perfect
                            ? 'Near / Slant'
                            : 'Mixed'}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full border border-[color:var(--rl-shell-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">
                        {estimateSyllables(suggestion)} syl
                      </span>
                      {index < 3 ? (
                        <span className="text-[10px] uppercase tracking-[0.08em] text-[#c4932a] dark:text-[#f2d000]/85">
                          Top
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {debugEnabled && activePanelDebug && (() => {
            const stageOrder = [
              'generated',
              'afterModeFilter',
              'afterCommonOnly',
              'afterRuleFilters',
              'afterDedupe',
              'afterSort',
              'afterCap',
            ]
            const stageSummary = stageOrder
              .filter((key) => activePanelDebug.stageCounts[key] !== undefined)
              .map((key) => `${key}=${activePanelDebug.stageCounts[key]}`)
              .join(', ')
            const rejectionEntries = Object.entries(activePanelDebug.rejections)
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
            const mismatch =
              activePanelDebug.activeModes.length === 1 &&
              activePanelDebug.activeModes[0] === 'perfect' &&
              typeof activePanelDebug.poolCount === 'number' &&
              activePanelDebug.poolCount !== activePanelDebug.filteredCount
                ? `Mismatch: poolCount=${activePanelDebug.poolCount} displayedCount=${activePanelDebug.filteredCount}`
                : null
            return (
              <div className="mt-4 space-y-1 rounded-md border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900/80 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100/80">
                <div>
                  <span className="font-semibold">Target:</span>{' '}
                  &quot;{activePanelDebug.rawTarget}&quot; → &quot;{activePanelDebug.normalizedTarget}&quot;
                </div>
                <div>
                  <span className="font-semibold">Modes:</span> {activePanelDebug.activeModes.join(', ') || '—'}
                </div>
                <div>
                  <span className="font-semibold">Counts:</span>{' '}
                  {typeof activePanelDebug.poolCount === 'number' ? `pool=${activePanelDebug.poolCount} | ` : ''}
                  filtered={activePanelDebug.filteredCount} | rendered={activePanelDebug.renderedCount ?? 0}
                </div>
                {mismatch && (
                  <div className="text-rose-600 dark:text-rose-300">
                    <span className="font-semibold">Warning:</span> {mismatch}
                  </div>
                )}
                {activePanelDebug.cap?.applied && (
                  <div>
                    <span className="font-semibold">Cap:</span>{' '}
                    applied=true limit={activePanelDebug.cap.limit ?? '—'} stage=&quot;{activePanelDebug.cap.stage ?? '—'}&quot;
                  </div>
                )}
                <div>
                  <span className="font-semibold">Stages:</span> {stageSummary || '—'}
                </div>
                <div>
                  <span className="font-semibold">Filtered out:</span>
                  {rejectionEntries.length === 0 ? ' —' : (
                    <ul className="mt-1 space-y-0.5">
                      {rejectionEntries.map(([reason, count]) => (
                        <li key={reason}>
                          {reason}: {count}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    )

    const panelRootProps = {
      tabIndex: 0,
      onKeyDown: handleKeyDown,
      className: 'focus:outline-none',
      'data-testid': 'rhyme-panel-root',
      id: 'rhyme-expanded-panel',
      role: 'region',
      'aria-labelledby': 'rhyme-panel-target',
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
