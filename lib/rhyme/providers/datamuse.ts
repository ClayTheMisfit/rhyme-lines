
export interface RhymeSuggestion {
  word: string
  type: 'perfect' | 'slant'
  score: number
  syllables?: number
  frequency?: number
  source?: string
}

export interface DatamuseResponse {
  word: string
  score: number
  numSyllables?: number
  tags?: string[]
}

const DATAMUSE_BASE = 'https://api.datamuse.com/words'

export async function fetchPerfectRhymes(word: string): Promise<RhymeSuggestion[]> {
  if (!word.trim()) return []
  
  try {
    const url = new URL(DATAMUSE_BASE)
    url.searchParams.set('rel_rhy', word.toLowerCase())
    url.searchParams.set('md', 'rfs') // Request frequency and syllables
    url.searchParams.set('max', '50')
    
    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const data: DatamuseResponse[] = await response.json()
    
    return data.map(item => ({
      word: item.word,
      type: 'perfect' as const,
      score: isNaN(item.score) ? 0 : item.score,
      syllables: isNaN(item.numSyllables || 0) ? undefined : item.numSyllables,
      frequency: extractFrequency(item.tags),
      source: 'datamuse',
    }))
  } catch (error) {
    console.warn('Datamuse perfect rhymes failed:', error)
    return []
  }
}

export async function fetchSlantRhymes(word: string): Promise<RhymeSuggestion[]> {
  if (!word.trim()) return []
  
  try {
    const url = new URL(DATAMUSE_BASE)
    url.searchParams.set('rel_nry', word.toLowerCase()) // Near rhymes
    url.searchParams.set('md', 'rfs')
    url.searchParams.set('max', '50')
    
    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const data: DatamuseResponse[] = await response.json()
    
    return data.map(item => ({
      word: item.word,
      type: 'slant' as const,
      score: isNaN(item.score) ? 0 : item.score,
      syllables: isNaN(item.numSyllables || 0) ? undefined : item.numSyllables,
      frequency: extractFrequency(item.tags),
      source: 'datamuse',
    }))
  } catch (error) {
    console.warn('Datamuse slant rhymes failed:', error)
    return []
  }
}

function extractFrequency(tags?: string[]): number {
  if (!tags) return 0
  
  const freqTag = tags.find(tag => tag.startsWith('f:'))
  if (!freqTag) return 0
  
  const freq = parseInt(freqTag.slice(2), 10)
  return isNaN(freq) ? 0 : Math.max(0, freq)
}
