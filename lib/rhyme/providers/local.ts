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



export function generateLocalRhymes(word: string): RhymeSuggestion[] {
  if (!word.trim()) return []
  
  const normalized = word.toLowerCase().trim()
  const suggestions: RhymeSuggestion[] = []
  

  const perfectRhymes = generatePerfectRhymes(normalized)
  suggestions.push(...perfectRhymes)
  
  // Generate slant rhymes based on similar patterns
  const slantRhymes = generateSlantRhymes(normalized)
  suggestions.push(...slantRhymes)
  

}

function generatePerfectRhymes(word: string): RhymeSuggestion[] {
  const rhymes: RhymeSuggestion[] = []
  

    }
  }
  
  return rhymes
}

function generateSlantRhymes(word: string): RhymeSuggestion[] {
  const rhymes: RhymeSuggestion[] = []
  

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
