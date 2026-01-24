'use client'

import * as React from 'react'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
import { useSettingsStore } from '@/store/settingsStore'
import { layers } from '@/lib/layers'
import { useRhymePanel, type RhymePanelMode } from '@/lib/state/rhymePanel'
import { DockablePanel } from '@/components/panels/DockablePanel'
import { useRhymeSuggestions } from '@/lib/rhyme-db/useRhymeSuggestions'
import type { Mode } from '@/lib/rhyme-db/queryRhymes'
import type { RhymeFilters } from '@/lib/persist/schema'
import type { EditorHandle } from '@/components/Editor'
import { getLocalInitFailureReason } from '@/lib/rhymes/rhymeSource'
import { useMemo, useState } from 'react'
import { normalizeToken } from '@/lib/rhyme-db/normalizeToken'
import { buildVisibleSuggestions, DEFAULT_SUGGESTION_CAP } from '@/components/rhyme/buildVisibleSuggestions'

const MIN_WIDTH = 280
const MAX_WIDTH = 640
type QualityKey = keyof RhymeFilters

const QUALITY_CHIPS: ReadonlyArray<{ label: string; value: QualityKey }> = [
  { label: 'Perfect', value: 'perfect' },
  { label: 'Near', value: 'near' },
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
    } = useRhymePanelStore((state) => ({
      selectedIndex: state.selectedIndex,
      setSelectedIndex: state.setSelectedIndex,
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      multiSyllablePerfect: state.multiSyllablePerfect,
      setMultiSyllablePerfect: state.setMultiSyllablePerfect,
    }))

    const [advancedOpen, setAdvancedOpen] = useState(false)
    const [debouncedQuery, setDebouncedQuery] = useState(searchQuery)

    const {
      includeRareWords,
      setIncludeRareWords,
      showVariants,
      setShowVariants,
      commonWordsOnly,
      setCommonWordsOnly,
      rhymeFilters,
      setRhymeFilters,
    } = useSettingsStore((state) => ({
      includeRareWords: state.includeRareWords,
      setIncludeRareWords: state.setIncludeRareWords,
      showVariants: state.showVariants,
      setShowVariants: state.setShowVariants,
      commonWordsOnly: state.commonWordsOnly,
      setCommonWordsOnly: state.setCommonWordsOnly,
      rhymeFilters: state.rhymeFilters,
      setRhymeFilters: state.setRhymeFilters,
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

    const activeModes = useMemo(
      () => QUALITY_CHIPS.filter((chip) => rhymeFilters[chip.value]).map((chip) => chip.value),
      [rhymeFilters]
    )
    const resolvedModes = useMemo(
      () => (activeModes.length > 0 ? activeModes : QUALITY_CHIPS.map((chip) => chip.value)),
      [activeModes]
    )

    const normalizedQueryToken = useMemo(() => normalizeToken(debouncedQuery), [debouncedQuery])
    const isQueryActive = Boolean(normalizedQueryToken)

    const {
      status,
      error,
      warning,
      results,
      debug,
      meta,
      phase,
    } = useRhymeSuggestions({
      text,
      caretIndex,
      currentLineText,
      queryToken: debouncedQuery,
      modes: resolvedModes,
      max: DEFAULT_SUGGESTION_CAP,
      multiSyllable: multiSyllablePerfect,
      includeRareWords,
      showVariants,
      commonWordsOnly,
      enabled: mode !== 'hidden',
    })

    const caretSuggestions = results.caret ?? []
    const lineSuggestions = results.lineLast ?? []
    const activeSuggestions = isQueryActive
      ? (results.caret ?? results.lineLast ?? [])
      : activeTab === 'caret'
        ? caretSuggestions
        : lineSuggestions
    const visibleSuggestions = useMemo(
      () => buildVisibleSuggestions(activeSuggestions),
      [activeSuggestions]
    )

    const caretToken = debug.caretDetails?.normalizedToken ?? debug.caretToken
    const lineLastToken = debug.lineLastDetails?.normalizedToken ?? debug.lineLastToken
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
    const LIMITED_COMMON_THRESHOLD = 10
    const totalAvailable = activeDebug?.afterModeMatchCount ?? activeSuggestions.length
    const filteredCount = visibleSuggestions.length
    const isFiltered = totalAvailable > filteredCount

    React.useEffect(() => {
      suggestionsRef.current = visibleSuggestions
    }, [visibleSuggestions])

    const resultsKey = useMemo(
      () => [
        activeTokenLabel,
        activeToken ?? '',
        resolvedModes.join(','),
        includeRareWords,
        showVariants,
        commonWordsOnly,
        multiSyllablePerfect,
        activeTab,
        isQueryActive,
      ].join('|'),
      [
        activeTab,
        activeToken,
        activeTokenLabel,
        includeRareWords,
        showVariants,
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
      if (debouncedQuery === searchQuery) return
      const timer = window.setTimeout(() => {
        setDebouncedQuery(searchQuery)
      }, 200)
      return () => {
        window.clearTimeout(timer)
      }
    }, [debouncedQuery, searchQuery])

    React.useEffect(() => {
      if (activeModes.length === 0) {
        const resetFilters = QUALITY_CHIPS.reduce<RhymeFilters>((acc, chip) => {
          acc[chip.value] = true
          return acc
        }, { perfect: true, near: true })
        setRhymeFilters(resetFilters)
      }
    }, [activeModes.length, setRhymeFilters])

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
      <div className="flex h-full min-h-0 flex-col">
        <div className="px-3 pt-3">
          <div className="space-y-3 rounded-lg border border-slate-200/70 bg-slate-50/80 p-3 text-[12px] text-slate-600 shadow-sm dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-300">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
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
                className="w-full rounded-md border border-slate-200/70 bg-white/80 px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:ring-offset-slate-900"
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

            <div className="flex flex-wrap items-center gap-2">
              {QUALITY_CHIPS.map((chip) => {
                const isActive = rhymeFilters[chip.value]
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
                    onClick={() => {
                      const next = { ...rhymeFilters, [chip.value]: !rhymeFilters[chip.value] }
                      const hasAny = Object.values(next).some(Boolean)
                      setRhymeFilters(hasAny ? next : { perfect: true, near: true })
                    }}
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

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAdvancedOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-slate-400 dark:hover:text-slate-200 dark:focus-visible:ring-offset-slate-900"
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
              <div id="rhyme-advanced" className="space-y-3 rounded-md border border-slate-200/60 bg-white/70 p-2 text-[11px] text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-400">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 dark:border-slate-600 dark:bg-slate-900 dark:text-sky-400"
                    checked={multiSyllablePerfect}
                    onChange={(event) => setMultiSyllablePerfect(event.target.checked)}
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
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 dark:border-slate-600 dark:bg-slate-900 dark:text-sky-400"
                    checked={includeRareWords}
                    onChange={(event) => setIncludeRareWords(event.target.checked)}
                  />
                  <span className="space-y-1">
                    <span className="block text-slate-600 dark:text-slate-300">Include rare / proper nouns</span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                      Include names and uncommon words.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 dark:border-slate-600 dark:bg-slate-900 dark:text-sky-400"
                    checked={showVariants}
                    onChange={(event) => setShowVariants(event.target.checked)}
                    disabled={includeRareWords}
                  />
                  <span className="space-y-1">
                    <span className="block text-slate-600 dark:text-slate-300">
                      Show spelling variants
                      {includeRareWords ? ' (covered by rare words)' : ''}
                    </span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                      Include uncommon spellings like batt or blatt.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 dark:border-slate-600 dark:bg-slate-900 dark:text-sky-400"
                    checked={commonWordsOnly}
                    onChange={(event) => setCommonWordsOnly(event.target.checked)}
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
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex-1 min-h-0 overflow-y-auto px-2 pb-3 pt-0 thin-scrollbar">
          {!isInitialLoading && (
            <div className="px-3 pb-2 text-[12px] text-slate-500 dark:text-slate-400">
              {activeTokenLabel}: {activeToken ?? '—'}
            </div>
          )}
          {!isInitialLoading && activeSuggestions.length > 0 && (
            <div className="px-3 pb-2 text-[11px] text-slate-400 dark:text-slate-500">
              {isFiltered ? `${filteredCount} results (total ${totalAvailable})` : `${totalAvailable} results`}
              {activeSuggestions.length > visibleSuggestions.length && (
                <span> · showing top {DEFAULT_SUGGESTION_CAP}</span>
              )}
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
                after mode: {activeDebug.afterModeMatchCount ?? '—'} · after rare: {activeDebug.afterRareRankOrFilterCount ?? '—'} ·
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

          {!isInitialLoading && !includeRareWords && status !== 'idle' && activeSuggestions.length > 0 &&
            activeSuggestions.length < LIMITED_COMMON_THRESHOLD && (
              <div className="px-3 pb-2 text-[11px] text-slate-400 dark:text-slate-500">
                Limited common matches — try Near or enable Rare words for more.
              </div>
            )}

          {isInitialLoading && (
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

          {status === 'idle' && !isInitialLoading && (
            <div className="px-3 py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
              Type a word or move the caret to load rhymes.
            </div>
          )}

          {error && (
            <div className="px-3 py-6 text-center text-[13px] text-rose-500">
              {status === 'error' ? 'Error loading suggestions: ' : 'Warning: '} {error}
              <div className="mt-2 text-[12px] text-rose-400">
                Details: {error}
              </div>
              {meta.source === 'local' && (
                <div className="mt-2 text-[12px] text-rose-400">
                  Verify public/rhyme-db/rhyme-db.v2.json exists (npm run build:rhyme-db).
                </div>
              )}
            </div>
          )}

          {!isInitialLoading && status !== 'idle' && visibleSuggestions.length === 0 && (
            <div className="px-3 py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
              {includeRareWords
                ? 'No rhymes found — try Near'
                : 'No common rhymes — try Near or enable Rare words.'}
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
