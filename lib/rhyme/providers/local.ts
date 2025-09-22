import type { RhymeSuggestion } from './datamuse'

// Simple phonetic patterns for local rhyming
const VOWEL_CHARACTERS = '[aeiouy]'
const SINGLE_VOWEL_REGEX = new RegExp(VOWEL_CHARACTERS, 'i')

function createVowelGroupRegex(): RegExp {
  return new RegExp(`${VOWEL_CHARACTERS}+`, 'gi')
}

function createDiphthongRegex(): RegExp {
  return new RegExp(`${VOWEL_CHARACTERS}{2,}`, 'gi')
}

// Common word endings for perfect rhymes
const PERFECT_ENDINGS = [
  'ight', 'ite', 'ate', 'ake', 'ame', 'ane', 'ace', 'ade', 'age',
  'ail', 'ain', 'air', 'ait', 'ake', 'ale', 'all', 'ame', 'and',
  'ang', 'ank', 'ant', 'any', 'ape', 'are', 'ark', 'arm', 'art',
  'ash', 'ask', 'ass', 'ast', 'ate', 'ave', 'awn', 'ay', 'aze',
  'ear', 'eat', 'eek', 'eel', 'eem', 'een', 'eep', 'eer', 'eet',
  'ice', 'ide', 'ife', 'ike', 'ile', 'ime', 'ine', 'ipe', 'ire',
  'ise', 'ite', 'ive', 'ize', 'oat', 'obe', 'ode', 'oke', 'ole',
  'ome', 'one', 'ong', 'ook', 'ool', 'oom', 'oon', 'oop', 'oot',
  'ore', 'ork', 'orn', 'ose', 'ote', 'oud', 'our', 'out', 'ove',
  'ow', 'own', 'oy', 'oze', 'ude', 'uge', 'uke', 'ule', 'ume',
  'une', 'ung', 'unk', 'unt', 'ure', 'use', 'ute', 'y'
]

// Common word endings for slant rhymes
const SLANT_ENDINGS = [
  'ing', 'tion', 'sion', 'ness', 'ment', 'able', 'ible', 'ful',
  'less', 'ly', 'er', 'est', 'ed', 'ing', 'al', 'ic', 'ive',
  'ous', 'ious', 'eous', 'eous', 'ary', 'ory', 'ery', 'ity',
  'ety', 'ty', 'cy', 'sy', 'my', 'ny', 'py', 'ry', 'vy', 'zy'
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
  
  return suggestions.slice(0, 30) // Limit results
}

function generatePerfectRhymes(word: string): RhymeSuggestion[] {
  const rhymes: RhymeSuggestion[] = []
  
  // Find matching ending patterns
  for (const ending of PERFECT_ENDINGS) {
    if (word.endsWith(ending)) {
      const base = word.slice(0, -ending.length)
      
      // Generate variations with different consonants
      const consonants = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z']
      
      for (const consonant of consonants) {
        const newWord = base + consonant + ending.slice(1)
        if (newWord !== word && isValidWord(newWord)) {
          rhymes.push({
            word: newWord,
            type: 'perfect',
            score: calculateScore(word, newWord, 'perfect'),
            syllables: estimateSyllables(newWord),
          })
        }
      }
    }
  }
  
  return rhymes
}

function generateSlantRhymes(word: string): RhymeSuggestion[] {
  const rhymes: RhymeSuggestion[] = []
  
  // Find similar ending patterns for slant rhymes
  for (const ending of SLANT_ENDINGS) {
    if (word.endsWith(ending)) {
      const base = word.slice(0, -ending.length)
      
      // Generate variations with different vowels
      const vowels = ['a', 'e', 'i', 'o', 'u', 'y']
      
      for (const vowel of vowels) {
        const newWord = base + vowel + ending.slice(1)
        if (newWord !== word && isValidWord(newWord)) {
          rhymes.push({
            word: newWord,
            type: 'slant',
            score: calculateScore(word, newWord, 'slant'),
            syllables: estimateSyllables(newWord),
          })
        }
      }
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
  
  const score = baseScore + lengthBonus + letterBonus
  return isNaN(score) ? 0 : score
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

function estimateSyllables(word: string): number {
  const vowels = word.match(createVowelGroupRegex())
  if (!vowels) return 1

  let count = vowels.length

  // Adjust for silent 'e'
  if (word.endsWith('e') && count > 1) count--

  // Adjust for diphthongs
  const diphthongs = word.match(createDiphthongRegex())
  if (diphthongs) count -= diphthongs.length - 1

  const result = Math.max(1, count)
  return isNaN(result) ? 1 : result
}

function isValidWord(word: string): boolean {
  // Basic validation - must be 2+ characters, only letters
  if (word.length < 2) return false
  if (!/^[a-z]+$/i.test(word)) return false

  // Must have at least one vowel
  return SINGLE_VOWEL_REGEX.test(word)
}

export const __testables = { isValidWord }
