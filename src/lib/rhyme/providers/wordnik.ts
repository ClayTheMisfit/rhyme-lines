import type { RhymeSuggestion } from './datamuse'
import { estimateSyllables } from '@/lib/nlp/estimateSyllables'

const WORDNIK_API_ENDPOINT = '/api/wordnik'

export interface WordnikRelatedResponse {
  word: string
  id: number
  relationshipType: string
  words: string[]
}

interface WordnikApiResult {
  suggestions: RhymeSuggestion[]
}

export async function fetchWordnikRelatedWords(word: string): Promise<RhymeSuggestion[]> {
  return fetchWordnikSuggestions(word, 'perfect')
}

export async function fetchWordnikSimilarWords(word: string): Promise<RhymeSuggestion[]> {
  return fetchWordnikSuggestions(word, 'slant')
}

async function fetchWordnikSuggestions(
  word: string,
  type: 'perfect' | 'slant'
): Promise<RhymeSuggestion[]> {
  if (!word.trim()) return []

  try {
    const params = new URLSearchParams({
      word: word.toLowerCase(),
      type,
    })

    const response = await fetch(`${WORDNIK_API_ENDPOINT}?${params.toString()}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const payload = (await response.json()) as WordnikApiResult
    if (!payload || !Array.isArray(payload.suggestions)) {
      return []
    }

    return payload.suggestions
  } catch (error) {
    console.warn(`Wordnik ${type} words failed:`, error)
    return []
  }
}

export function buildWordnikSuggestions(
  word: string,
  data: WordnikRelatedResponse[],
  type: 'perfect' | 'slant'
): RhymeSuggestion[] {
  if (!word.trim()) return []

  const normalized = word.toLowerCase()
  const relationshipType = type === 'perfect' ? 'rhyme' : 'similar-to'
  const maxResults = type === 'perfect' ? 50 : 30

  const suggestions: RhymeSuggestion[] = []

  for (const item of data) {
    if (item.relationshipType !== relationshipType || !item.words) continue

    for (const candidate of item.words) {
      const baseScore = calculateScore(normalized, candidate)
      const adjustedScore =
        type === 'perfect'
          ? baseScore
          : Math.min(100, Math.max(0, baseScore * 0.7))

      suggestions.push({
        word: candidate,
        type,
        score: adjustedScore,
        syllables: estimateSyllables(candidate),
        source: 'wordnik',
      })
    }
  }

  return suggestions.slice(0, maxResults)
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

