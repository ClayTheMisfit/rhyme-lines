import type { RhymeSuggestion } from './datamuse'
import { estimateSyllables } from '@/lib/nlp/estimateSyllables'

// Simple phonetic patterns for local rhyming
const VOWEL_CHARACTERS = '[aeiouy]'
const SINGLE_VOWEL_REGEX = new RegExp(VOWEL_CHARACTERS, 'i')

function createVowelGroupRegex(): RegExp {
  return new RegExp(`${VOWEL_CHARACTERS}+`, 'gi')
}

// Simple word database for local rhyming
const COMMON_WORDS = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
  'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him',
  'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only',
  'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want',
  'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'each', 'which', 'their',
  'said', 'each', 'which', 'she', 'do', 'how', 'its', 'if', 'will', 'up', 'other', 'about', 'out', 'many', 'then', 'them', 'these', 'so',
  'some', 'her', 'would', 'make', 'like', 'into', 'him', 'time', 'has', 'two', 'more', 'go', 'no', 'way', 'could', 'my', 'than', 'first',
  'water', 'been', 'call', 'who', 'oil', 'its', 'now', 'find', 'long', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part'
]

export function generateLocalRhymes(word: string): RhymeSuggestion[] {
  if (!word.trim()) return []
  
  const normalized = word.toLowerCase().trim()
  const suggestions: RhymeSuggestion[] = []
  
  // Generate perfect rhymes based on ending patterns
  const perfectRhymes = generatePerfectRhymes(normalized)
  suggestions.push(...perfectRhymes)
  
  // Generate slant rhymes based on similar patterns
  const slantRhymes = generateSlantRhymes(normalized)
  suggestions.push(...slantRhymes)
  
  return suggestions.slice(0, 20) // Limit local results
}

function generatePerfectRhymes(word: string): RhymeSuggestion[] {
  const rhymes: RhymeSuggestion[] = []
  
  // Simple perfect rhyme detection based on ending patterns
  const ending = word.slice(-2) // Last 2 characters
  const ending3 = word.slice(-3) // Last 3 characters
  
  for (const candidate of COMMON_WORDS) {
    if (candidate === word) continue
    
    if (candidate.endsWith(ending) || candidate.endsWith(ending3)) {
      rhymes.push({
        word: candidate,
        type: 'perfect',
        score: calculateScore(word, candidate, 'perfect'),
        syllables: estimateSyllables(candidate),
        source: 'local',
      })
    }
  }
  
  return rhymes
}

function generateSlantRhymes(word: string): RhymeSuggestion[] {
  const rhymes: RhymeSuggestion[] = []
  
  // Generate slant rhymes based on similar vowel patterns
  const vowels = word.match(createVowelGroupRegex())
  if (!vowels) return rhymes
  
  for (const candidate of COMMON_WORDS) {
    if (candidate === word) continue
    
    const candidateVowels = candidate.match(createVowelGroupRegex())
    if (!candidateVowels) continue
    
    // Check for similar vowel patterns
    if (vowels.length === candidateVowels.length) {
      rhymes.push({
        word: candidate,
        type: 'slant',
        score: calculateScore(word, candidate, 'slant'),
        syllables: estimateSyllables(candidate),
        source: 'local',
      })
    }
  }
  
  return rhymes
}

function calculateScore(original: string, candidate: string, type: 'perfect' | 'slant'): number {
  const baseScore = type === 'perfect' ? 100 : 50
  
  // Bonus for similar length
  const lengthDiff = Math.abs(original.length - candidate.length)
  const lengthBonus = Math.max(0, 20 - lengthDiff)
  
  // Bonus for common letters
  const commonLetters = countCommonLetters(original, candidate)
  const letterBonus = commonLetters * 5
  
  return Math.min(100, baseScore + lengthBonus + letterBonus)
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

function isValidWord(word: string): boolean {
  // Basic validation - must be 2+ characters, only letters
  if (word.length < 2) return false
  if (!/^[a-z]+$/i.test(word)) return false

  // Must have at least one vowel
  return SINGLE_VOWEL_REGEX.test(word)
}

export const __testables = { isValidWord }