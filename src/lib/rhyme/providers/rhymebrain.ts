import type { RhymeSuggestion } from './datamuse'

const RHYMEBRAIN_BASE = 'https://rhymebrain.com/talk'

export interface RhymeBrainResponse {
  word: string
  score: number
  syllables: number
  flags: string
}

export async function fetchRhymeBrainRhymes(word: string, signal?: AbortSignal): Promise<RhymeSuggestion[]> {
  if (!word.trim()) return []
  
  const url = new URL(RHYMEBRAIN_BASE)
  url.searchParams.set('function', 'getRhymes')
  url.searchParams.set('word', word.toLowerCase())
  
  const response = await fetch(url.toString(), { signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  
  const data: RhymeBrainResponse[] = await response.json()
  
  return data.map(item => ({
    word: item.word,
    type: determineRhymeType(item.flags),
    score: isNaN(item.score) ? 0 : item.score,
    syllables: isNaN(item.syllables) ? undefined : item.syllables,
    source: 'rhymebrain',
  }))
}

function determineRhymeType(flags: string): 'perfect' | 'near' | 'slant' {
  // RhymeBrain flags: 'p' = perfect, 'n' = near/slant
  if (flags.includes('p')) return 'perfect'
  if (flags.includes('n')) return 'near'
  
  // Default to slant if unclear
  return 'slant'
}
