import type { RhymeSuggestion } from './datamuse'

const WORDNIK_BASE = 'https://api.wordnik.com/v4'
const WORDNIK_API_KEY = 'ht6r56caorqqp336gegazkmo2hmiarprpnn9vkjzc5l7n394y'

export interface WordnikResponse {
  word: string
  id: number
}

export interface WordnikRelatedResponse {
  word: string
  id: number
  relationshipType: string
  words: string[]
}

export async function fetchWordnikRelatedWords(word: string): Promise<RhymeSuggestion[]> {
  if (!word.trim()) return []
  
  try {
    const url = new URL(`${WORDNIK_BASE}/word.json/${encodeURIComponent(word.toLowerCase())}/relatedWords`)
    url.searchParams.set('api_key', WORDNIK_API_KEY)
    url.searchParams.set('relationshipTypes', 'rhyme')
    url.searchParams.set('limitPerRelationshipType', '50')
    url.searchParams.set('useCanonical', 'true')
    
    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const data: WordnikRelatedResponse[] = await response.json()
    
    const suggestions: RhymeSuggestion[] = []
    
    for (const item of data) {
      if (item.relationshipType === 'rhyme' && item.words) {
        for (const relatedWord of item.words) {
          suggestions.push({
            word: relatedWord,
            type: 'perfect', // Wordnik rhymes are typically perfect rhymes
            score: calculateScore(word, relatedWord),
            syllables: estimateSyllables(relatedWord),
          })
        }
      }
    }
    
    return suggestions.slice(0, 50) // Limit results
    
  } catch (error) {
    console.warn('Wordnik related words failed:', error)
    return []
  }
}

export async function fetchWordnikSimilarWords(word: string): Promise<RhymeSuggestion[]> {
  if (!word.trim()) return []
  
  try {
    const url = new URL(`${WORDNIK_BASE}/word.json/${encodeURIComponent(word.toLowerCase())}/relatedWords`)
    url.searchParams.set('api_key', WORDNIK_API_KEY)
    url.searchParams.set('relationshipTypes', 'similar-to')
    url.searchParams.set('limitPerRelationshipType', '30')
    url.searchParams.set('useCanonical', 'true')
    
    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const data: WordnikRelatedResponse[] = await response.json()
    
    const suggestions: RhymeSuggestion[] = []
    
    for (const item of data) {
      if (item.relationshipType === 'similar-to' && item.words) {
        for (const similarWord of item.words) {
          suggestions.push({
            word: similarWord,
            type: 'slant', // Similar words are slant rhymes
            score: calculateScore(word, similarWord) * 0.7, // Lower score for slant rhymes
            syllables: estimateSyllables(similarWord),
          })
        }
      }
    }
    
    return suggestions.slice(0, 30) // Limit results
    
  } catch (error) {
    console.warn('Wordnik similar words failed:', error)
    return []
  }
}

function calculateScore(original: string, candidate: string): number {
  const baseScore = 80 // Base score for Wordnik results
  
  // Bonus for similar length
  const lengthDiff = Math.abs(original.length - candidate.length)
  const lengthBonus = Math.max(0, 15 - lengthDiff)
  
  // Bonus for common letters
  const commonLetters = countCommonLetters(original, candidate)
  const letterBonus = commonLetters * 3
  
  // Bonus for similar ending patterns
  const endingBonus = calculateEndingSimilarity(original, candidate)
  
  const score = baseScore + lengthBonus + letterBonus + endingBonus
  return Math.min(100, Math.max(0, score)) // Clamp between 0 and 100
}

function countCommonLetters(word1: string, word2: string): number {
  const letters1 = new Set(word1.toLowerCase())
  const letters2 = new Set(word2.toLowerCase())
  
  let common = 0
  for (const letter of letters1) {
    if (letters2.has(letter)) common++
  }
  
  return common
}

function calculateEndingSimilarity(word1: string, word2: string): number {
  const w1 = word1.toLowerCase()
  const w2 = word2.toLowerCase()
  
  // Check for similar endings (last 2-4 characters)
  for (let i = 2; i <= 4; i++) {
    if (w1.length >= i && w2.length >= i) {
      const ending1 = w1.slice(-i)
      const ending2 = w2.slice(-i)
      if (ending1 === ending2) {
        return i * 5 // More points for longer matching endings
      }
    }
  }
  
  return 0
}

function estimateSyllables(word: string): number {
  const vowels = word.match(/[aeiouy]+/gi)
  if (!vowels) return 1
  
  let count = vowels.length
  
  // Adjust for silent 'e'
  if (word.endsWith('e') && count > 1) count--
  
  // Adjust for diphthongs
  const diphthongs = word.match(/[aeiouy]{2,}/gi)
  if (diphthongs) count -= diphthongs.length - 1
  
  return Math.max(1, count)
}
