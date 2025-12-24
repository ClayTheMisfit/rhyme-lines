import * as React from 'react'
import type { AggregatedSuggestion } from '@/lib/rhyme/aggregate'
import { estimateSyllables } from '@/lib/nlp/estimateSyllables'

interface SuggestionItemProps {
  suggestion: AggregatedSuggestion
  isSelected: boolean
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  index: number
  id: string
}

const qualityClasses: Record<AggregatedSuggestion['quality'], string> = {
  perfect: 'text-emerald-600 dark:text-emerald-300',
  near: 'text-sky-600 dark:text-sky-300',
  slant: 'text-amber-600 dark:text-amber-300',
}

const qualityLabels: Record<AggregatedSuggestion['quality'], string> = {
  perfect: 'Perfect',
  near: 'Near',
  slant: 'Slant',
}

function SuggestionItem({
  suggestion,
  isSelected,
  onClick,
  index,
  id,
}: SuggestionItemProps) {
  const { word, syllables } = suggestion
  const syllableCount = syllables ?? estimateSyllables(word)

  return (
    <button
      type="button"
      onClick={onClick}
      role="option"
      aria-selected={isSelected}
      data-index={index}
      id={id}
      className={`relative w-full rounded-lg border border-transparent px-3 py-2 text-left text-[13px] transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
        isSelected
          ? 'border-sky-500/40 bg-sky-500/10 shadow-sm dark:border-sky-400/40 dark:bg-sky-400/10'
          : 'hover:bg-slate-100/70 active:bg-slate-200/60 dark:hover:bg-white/5 dark:active:bg-white/10'
      } ${isSelected ? "before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-sky-500 before:content-['']" : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-900 dark:text-slate-100">{word}</span>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className={`uppercase tracking-wide ${qualityClasses[suggestion.quality]}`}>
            {qualityLabels[suggestion.quality]}
          </span>
          <span className="rounded-full border border-slate-200/70 bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-400">
            {syllableCount}
          </span>
        </div>
      </div>
    </button>
  )
}

export default React.memo(SuggestionItem)
