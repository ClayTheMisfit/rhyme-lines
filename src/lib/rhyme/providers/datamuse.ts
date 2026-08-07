export interface RhymeSuggestion {
  word: string
  type: 'perfect' | 'slant' | 'near'
  score: number
  syllables?: number
  frequency?: number
  source?: string
  tags?: string[]
}

export interface DatamuseResponse {
  word: string
  score: number
  numSyllables?: number
  tags?: string[]
}

const DATAMUSE_BASE = 'https://api.datamuse.com/words'

export async function fetchPerfectRhymes(word: string, signal?: AbortSignal): Promise<RhymeSuggestion[]> {
  if (!word.trim()) return []

  const url = new URL(DATAMUSE_BASE)
  url.searchParams.set('rel_rhy', word.toLowerCase())
  url.searchParams.set('md', 'rfs')
  url.searchParams.set('max', '50')

  const response = await fetch(url.toString(), { signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const data: DatamuseResponse[] = await response.json()

  return data.map(item => ({
    word: item.word,
    type: 'perfect' as const,
    score: isNaN(item.score) ? 0 : item.score,
    syllables: isNaN(item.numSyllables || 0) ? undefined : item.numSyllables,
    frequency: extractFrequency(item.tags),
    source: 'datamuse',
    tags: item.tags,
  }))
}

export async function fetchSlantRhymes(word: string, signal?: AbortSignal): Promise<RhymeSuggestion[]> {
  if (!word.trim()) return []

  const url = new URL(DATAMUSE_BASE)
  url.searchParams.set('rel_nry', word.toLowerCase())
  url.searchParams.set('md', 'rfs')
  url.searchParams.set('max', '50')

  const response = await fetch(url.toString(), { signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const data: DatamuseResponse[] = await response.json()

  return data.map(item => ({
    word: item.word,
    type: 'near' as const,
    score: isNaN(item.score) ? 0 : item.score,
    syllables: isNaN(item.numSyllables || 0) ? undefined : item.numSyllables,
    frequency: extractFrequency(item.tags),
    source: 'datamuse',
    tags: item.tags,
  }))
}

function extractFrequency(tags?: string[]): number | undefined {
  if (!tags) return undefined
  
  const freqTag = tags.find(tag => tag.startsWith('f:'))
  if (!freqTag) return undefined
  
  const freq = Number.parseFloat(freqTag.slice(2))
  return Number.isNaN(freq) ? undefined : Math.max(0, freq)
}
