import type { AggregatedSuggestion } from '@/lib/rhyme/aggregate'

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
  const { word, syllables, frequency, sources, score } = suggestion

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
        
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {syllables && (
            <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: '#4a3a5a' }}>
              {syllables}
            </span>
          )}
          
          {frequency && !isNaN(frequency) && (
            <span className="text-gray-500">
              {frequency > 1000 ? `${Math.round(frequency / 1000)}k` : frequency}
            </span>
          )}
          
          <span className="text-gray-600">
            {isNaN(score) ? '0' : Math.round(score)}
          </span>
        </div>
      </div>
      
      {sources.length > 1 && (
        <div className="mt-1 text-xs text-gray-500">
          {sources.join(', ')}
        </div>
      )}
    </button>
  )
}
