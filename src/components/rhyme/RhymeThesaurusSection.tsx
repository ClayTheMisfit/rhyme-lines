'use client'

import * as React from 'react'
import type { Mode } from '@/lib/rhyme-db/queryRhymes'
import { useRhymeSuggestions } from '@/lib/rhyme-db/useRhymeSuggestions'
import { buildVisibleSuggestions } from '@/components/rhyme/buildVisibleSuggestions'
import { normalizeToken } from '@/lib/rhyme-db/normalizeToken'
import { useRhymeThesaurus } from '@/lib/thesaurus/useRhymeThesaurus'
import type { ThesaurusConcept } from '@/lib/thesaurus/types'
import { trackEvent } from '@/lib/analytics/events'
import type { RhymePanelMode } from '@/lib/state/rhymePanel'

const CONCEPT_RHYME_LIMIT = 24

type Props = {
  target: string | null | undefined
  modes: Mode[]
  commonWordsOnly: boolean
  multiSyllable: boolean
  panelMode: RhymePanelMode
  onInsertRhyme: (word: string) => void
}

const conceptButtonClass = (selected: boolean) =>
  `rounded-full border px-2.5 py-1 text-[12px] transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--rl-shell-elevated)] dark:focus-visible:ring-white/25 dark:focus-visible:ring-offset-[#101012] ${
    selected
      ? 'border-[#c4932a]/70 bg-[#f2d000]/15 font-semibold text-slate-950 dark:text-[#fff6b0]'
      : 'border-[color:var(--rl-shell-border)] bg-[#eef2f5] text-slate-700 hover:text-slate-950 dark:bg-white/[0.03] dark:text-white/68 dark:hover:text-white/90'
  }`

export function RhymeThesaurusSection({
  target,
  modes,
  commonWordsOnly,
  multiSyllable,
  panelMode,
  onInsertRhyme,
}: Props) {
  const normalizedTarget = React.useMemo(() => normalizeToken(target ?? ''), [target])
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedConcept, setSelectedConcept] = React.useState<ThesaurusConcept | null>(null)
  const sectionId = React.useId()
  const regionRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setSelectedConcept(null)
  }, [normalizedTarget])

  const enabled = isOpen && panelMode !== 'hidden' && Boolean(normalizedTarget)
  const thesaurus = useRhymeThesaurus({ target: normalizedTarget, enabled })

  const reportedErrorKeyRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (thesaurus.status !== 'error') return
    const errorKey = `${thesaurus.normalizedTarget}|${thesaurus.error ?? ''}`
    if (reportedErrorKeyRef.current === errorKey) return
    reportedErrorKeyRef.current = errorKey
    trackEvent('rhyme_thesaurus_request_failed', { panelMode })
  }, [panelMode, thesaurus.error, thesaurus.normalizedTarget, thesaurus.status])

  const selectedWord = selectedConcept?.normalizedWord ?? ''
  const conceptRhymes = useRhymeSuggestions({
    text: selectedWord,
    caretIndex: selectedWord.length,
    currentLineText: selectedWord,
    queryToken: selectedWord,
    modes,
    max: undefined,
    multiSyllable,
    commonWordsOnly,
    debug: false,
    enabled: isOpen && panelMode !== 'hidden' && Boolean(selectedWord),
  })
  const visibleConceptRhymes = React.useMemo(
    () => buildVisibleSuggestions(conceptRhymes.results.caret ?? conceptRhymes.results.lineLast ?? [], { limit: CONCEPT_RHYME_LIMIT }),
    [conceptRhymes.results.caret, conceptRhymes.results.lineLast]
  )

  if (panelMode === 'hidden') return null

  const toggleOpen = () => {
    const next = !isOpen
    setIsOpen(next)
    trackEvent(next ? 'rhyme_thesaurus_opened' : 'rhyme_thesaurus_closed', { panelMode })
    if (!next) setSelectedConcept(null)
  }

  const selectConcept = (concept: ThesaurusConcept) => {
    setSelectedConcept(concept)
    trackEvent('rhyme_thesaurus_concept_selected', {
      relationship: concept.relationship,
      panelMode,
      source: concept.source,
    })
  }

  const insertConceptRhyme = (word: string) => {
    trackEvent('rhyme_thesaurus_rhyme_inserted', {
      relationship: selectedConcept?.relationship,
      panelMode,
      resultCount: visibleConceptRhymes.length,
      source: selectedConcept?.source,
    })
    onInsertRhyme(word)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !isOpen) return
    const targetNode = event.target as Node | null
    if (targetNode && regionRef.current?.contains(targetNode)) {
      event.stopPropagation()
      event.preventDefault()
      setIsOpen(false)
      setSelectedConcept(null)
      trackEvent('rhyme_thesaurus_closed', { panelMode })
    }
  }

  const hasCurrentResult = thesaurus.result?.target === thesaurus.normalizedTarget
  const currentResult = hasCurrentResult ? thesaurus.result : null
  const selectedConceptIsCurrent = Boolean(
    selectedConcept && currentResult?.concepts.some((concept) => concept.normalizedWord === selectedConcept.normalizedWord)
  )

  const renderConceptGroup = (label: string, concepts: ThesaurusConcept[]) => {
    if (concepts.length === 0) return null
    return (
      <div role="group" aria-labelledby={`${sectionId}-${label.toLowerCase().replace(/\s+/g, '-')}`} className="space-y-1.5">
        <p id={`${sectionId}-${label.toLowerCase().replace(/\s+/g, '-')}`} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-white/45">{label}</p>
        <div className="flex flex-wrap gap-1.5">
          {concepts.map((concept) => {
            const selected = selectedConcept?.normalizedWord === concept.normalizedWord
            return (
              <button
                key={`${concept.relationship}-${concept.normalizedWord}`}
                type="button"
                aria-pressed={selected}
                onClick={() => selectConcept(concept)}
                className={conceptButtonClass(selected)}
              >
                {selected && <span aria-hidden="true" className="mr-1">✓</span>}
                <span>{concept.word}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <section data-rhyme-panel-shortcuts="ignore" className="mb-2 rounded-md border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-elevated)]/95 p-3 text-[12px]" aria-labelledby={`${sectionId}-trigger`}>
      <button
        id={`${sectionId}-trigger`}
        type="button"
        aria-expanded={isOpen}
        aria-controls={`${sectionId}-region`}
        onClick={toggleOpen}
        className="inline-flex w-full items-center justify-between gap-2 text-left text-[12px] font-medium text-slate-700 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--rl-shell-elevated)] dark:text-white/72 dark:hover:text-white/92 dark:focus-visible:ring-white/25"
      >
        <span>Explore meanings</span>
        <span aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {isOpen && (
        <div
          id={`${sectionId}-region`}
          ref={regionRef}
          role="region"
          aria-label="Rhyme Thesaurus"
          onKeyDown={onKeyDown}
          className="mt-3 space-y-3 border-t border-[color:var(--rl-shell-border)] pt-3"
        >
          <div>
            <h3 className="text-[12px] font-semibold text-slate-900 dark:text-white/88">Rhyme Thesaurus</h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/45">
              Meaning paths for “{normalizedTarget || '—'}”
            </p>
          </div>

          {thesaurus.phase === 'initial' && (
            <p role="status" className="text-[12px] text-slate-500 dark:text-slate-400">Finding related meanings…</p>
          )}

          {thesaurus.status === 'error' && (
            <div role="status" className="rounded-sm border border-amber-500/25 bg-amber-500/10 p-2 text-[12px] text-amber-700 dark:text-amber-200">
              <p>Meaning suggestions are temporarily unavailable.</p>
              <button type="button" onClick={thesaurus.refresh} className="mt-1 text-[11px] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45">
                Try again
              </button>
            </div>
          )}

          {thesaurus.status === 'success' && currentResult && currentResult.concepts.length === 0 && (
            <p role="status" className="text-[12px] text-slate-500 dark:text-slate-400">No useful meaning alternatives found.</p>
          )}

          {currentResult && currentResult.concepts.length > 0 && (
            <div className="space-y-3">
              {renderConceptGroup('Synonyms', currentResult.synonyms)}
              {renderConceptGroup('Related concepts', currentResult.related)}
            </div>
          )}

          {selectedConceptIsCurrent && selectedConcept && (
            <div className="space-y-2 rounded-sm border border-[color:var(--rl-shell-border)] bg-[#eef2f5]/70 p-2 dark:bg-white/[0.03]">
              <p className="text-[11px] font-semibold text-slate-700 dark:text-white/72">Rhymes for “{selectedConcept.word}”</p>
              {conceptRhymes.phase === 'initial' && (
                <p role="status" className="text-[12px] text-slate-500 dark:text-slate-400">Finding rhymes for “{selectedConcept.word}”…</p>
              )}
              {conceptRhymes.status !== 'idle' && conceptRhymes.status !== 'loading' && visibleConceptRhymes.length === 0 && (
                <p role="status" className="text-[12px] text-slate-500 dark:text-slate-400">No strong rhymes found for “{selectedConcept.word}.”</p>
              )}
              {visibleConceptRhymes.length > 0 && (
                <div role="group" className="flex flex-wrap gap-1.5" aria-label={`Rhymes for ${selectedConcept.word}`}>
                  {visibleConceptRhymes.map((rhyme) => (
                    <button
                      key={rhyme}
                      type="button"
                      onClick={() => insertConceptRhyme(rhyme)}
                      className="rounded-full border border-[color:var(--rl-shell-border)] bg-[color:var(--rl-shell-elevated)] px-2.5 py-1 text-[12px] text-slate-800 transition-colors hover:border-[#f2d000]/35 hover:bg-[#f2d000]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d000]/45 dark:text-white/82"
                    >
                      {rhyme}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
