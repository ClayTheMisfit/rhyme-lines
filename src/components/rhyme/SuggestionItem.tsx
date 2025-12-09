import type { AggregatedSuggestion } from '@/lib/rhyme/aggregate'
import { estimateSyllables } from '@/lib/nlp/estimateSyllables'

interface SuggestionItemProps {
  suggestion: AggregatedSuggestion
  isSelected: boolean
  onClick: () => void
}

export default function SuggestionItem({
  suggestion,
  isSelected,
  onClick
}: SuggestionItemProps) {
  const { word, syllables } = suggestion
  const syllableCount = syllables ?? estimateSyllables(word)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full px-3 py-2 text-left text-sm transition-colors
        hover:bg-white/5 focus:bg-white/10 focus:outline-none
        ${isSelected ? 'bg-white/10' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-white">{word}</span>

        <div className="flex items-center text-xs text-gray-400">
          <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-2xs uppercase tracking-wide">
            {syllableCount}
          </span>
        </div>
      </div>
    </button>
  )
}
