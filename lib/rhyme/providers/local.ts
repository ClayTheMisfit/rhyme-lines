import type { RhymeSuggestion } from './datamuse'

// Simple phonetic patterns for local rhyming
const VOWEL_GROUP_PATTERN = /[aeiouy]+/gi
const VOWEL_PRESENT_PATTERN = /[aeiouy]/i

// Common English words that rhyme with each other
const RHYME_GROUPS: Record<string, string[]> = {
  // -ime rhymes
  'ime': ['time', 'rhyme', 'lime', 'dime', 'chime', 'prime', 'crime', 'climb', 'sublime', 'grime', 'mime', 'slime', 'thyme'],
  
  // -ate rhymes  
  'ate': ['late', 'gate', 'hate', 'fate', 'rate', 'date', 'mate', 'plate', 'state', 'great', 'wait', 'weight', 'straight'],
  
  // -ake rhymes
  'ake': ['make', 'take', 'bake', 'cake', 'lake', 'wake', 'shake', 'break', 'stake', 'snake', 'brake', 'flake'],
  
  // -ight rhymes
  'ight': ['light', 'night', 'right', 'fight', 'sight', 'tight', 'bright', 'flight', 'might', 'height', 'weight', 'straight'],
  
  // -all rhymes
  'all': ['call', 'fall', 'ball', 'wall', 'tall', 'small', 'hall', 'stall', 'crawl', 'brawl', 'drawl'],
  
  // -ing rhymes
  'ing': ['sing', 'ring', 'bring', 'thing', 'king', 'wing', 'spring', 'string', 'swing', 'cling', 'fling'],
  
  // -ong rhymes
  'ong': ['song', 'long', 'strong', 'wrong', 'belong', 'along', 'prolong', 'thong', 'gong'],
  
  // -oon rhymes
  'oon': ['moon', 'soon', 'noon', 'tune', 'spoon', 'cartoon', 'balloon', 'typhoon', 'monsoon'],
  
  // -ear rhymes
  'ear': ['hear', 'near', 'fear', 'clear', 'dear', 'year', 'beer', 'cheer', 'steer', 'pier'],
  
  // -ice rhymes
  'ice': ['nice', 'rice', 'price', 'twice', 'dice', 'slice', 'spice', 'advice', 'device', 'splice'],
  
  // -ine rhymes
  'ine': ['fine', 'line', 'mine', 'pine', 'wine', 'shine', 'define', 'decline', 'incline', 'refine'],
  
  // -one rhymes
  'one': ['done', 'gone', 'none', 'bone', 'stone', 'phone', 'alone', 'tone', 'zone', 'cone'],
  
  // -ore rhymes
  'ore': ['more', 'store', 'score', 'door', 'floor', 'before', 'ignore', 'explore', 'adore', 'restore'],
  
  // -out rhymes
  'out': ['about', 'shout', 'route', 'doubt', 'scout', 'sprout', 'trout', 'stout', 'without', 'throughout'],
  
  // -ow rhymes
  'ow': ['now', 'how', 'cow', 'bow', 'show', 'grow', 'know', 'throw', 'flow', 'slow', 'blow'],
  
  // -ay rhymes
  'ay': ['day', 'way', 'say', 'play', 'stay', 'may', 'pay', 'lay', 'gray', 'pray', 'spray'],
  
  // -ee rhymes
  'ee': ['see', 'free', 'tree', 'three', 'agree', 'degree', 'guarantee', 'referee', 'disagree'],
  
  // -oo rhymes
  'oo': ['too', 'zoo', 'moo', 'boo', 'coo', 'woo', 'shoo', 'taboo', 'bamboo', 'kangaroo'],
  
  // -air rhymes
  'air': ['fair', 'pair', 'care', 'share', 'bare', 'rare', 'square', 'stare', 'scare', 'prepare'],
  
  // -and rhymes
  'and': ['hand', 'land', 'stand', 'band', 'grand', 'brand', 'command', 'demand', 'understand'],
  
  // -end rhymes
  'end': ['bend', 'send', 'lend', 'friend', 'spend', 'trend', 'blend', 'pretend', 'defend', 'extend'],
  
  // -ind rhymes
  'ind': ['find', 'mind', 'kind', 'bind', 'wind', 'blind', 'grind', 'behind', 'remind', 'unwind'],
  
  // -old rhymes
  'old': ['cold', 'gold', 'hold', 'told', 'sold', 'fold', 'mold', 'bold', 'scold', 'unfold'],
  
  // -ook rhymes
  'ook': ['book', 'look', 'cook', 'took', 'hook', 'brook', 'crook', 'shook', 'overlook', 'undertook'],
  
  // -oom rhymes
  'oom': ['room', 'broom', 'groom', 'bloom', 'gloom', 'doom', 'zoom', 'assume', 'resume', 'consume'],
  
  // -our rhymes
  'our': ['hour', 'power', 'flower', 'tower', 'shower', 'sour', 'flour', 'devour', 'empower'],
  
  // -oy rhymes
  'oy': ['boy', 'toy', 'joy', 'enjoy', 'destroy', 'employ', 'deploy', 'alloy', 'cowboy'],
  
  // -uck rhymes
  'uck': ['luck', 'duck', 'truck', 'stuck', 'chuck', 'pluck', 'buck', 'muck', 'suck', 'tuck'],
  
  // -ump rhymes
  'ump': ['jump', 'bump', 'lump', 'pump', 'dump', 'hump', 'stump', 'trump', 'grump', 'slump'],
  
  // -unk rhymes
  'unk': ['junk', 'bunk', 'hunk', 'sunk', 'drunk', 'trunk', 'chunk', 'flunk', 'spunk', 'skunk'],
  
  // -urn rhymes
  'urn': ['burn', 'turn', 'learn', 'yearn', 'concern', 'return', 'overturn', 'discern', 'adjourn'],
  
  // -ush rhymes
  'ush': ['rush', 'bush', 'push', 'crush', 'brush', 'flush', 'blush', 'hush', 'mush', 'gush'],
  
  // -ust rhymes
  'ust': ['must', 'rust', 'trust', 'dust', 'just', 'bust', 'crust', 'thrust', 'adjust', 'disgust'],
  
  // -ute rhymes
  'ute': ['cute', 'mute', 'route', 'suit', 'fruit', 'recruit', 'pursuit', 'minute', 'absolute', 'resolute']
}

export function generateLocalRhymes(word: string): RhymeSuggestion[] {
  if (!word.trim()) return []
  
  const normalized = word.toLowerCase().trim()
  const suggestions: RhymeSuggestion[] = []
  
  // Generate perfect rhymes based on known rhyme groups
  const perfectRhymes = generatePerfectRhymes(normalized)
  suggestions.push(...perfectRhymes)
  
  // Generate slant rhymes based on similar patterns
  const slantRhymes = generateSlantRhymes(normalized)
  suggestions.push(...slantRhymes)
  
  return suggestions.slice(0, 15) // Limit results more strictly
}

function generatePerfectRhymes(word: string): RhymeSuggestion[] {
  const rhymes: RhymeSuggestion[] = []
  
  // Find the best matching rhyme group
  for (const [ending, rhymeWords] of Object.entries(RHYME_GROUPS)) {
    if (word.endsWith(ending)) {
      // Add all words from this rhyme group except the original word
      for (const rhymeWord of rhymeWords) {
        if (rhymeWord !== word && isValidWord(rhymeWord)) {
          rhymes.push({
            word: rhymeWord,
            type: 'perfect',
            score: calculateScore(word, rhymeWord, 'perfect'),
            syllables: estimateSyllables(rhymeWord),
            source: 'local',
          })
        }
      }
      break // Only use the first matching ending
    }
  }
  
  return rhymes
}

function generateSlantRhymes(word: string): RhymeSuggestion[] {
  const rhymes: RhymeSuggestion[] = []
  
  // Generate slant rhymes by finding words with similar endings
  for (const [ending, rhymeWords] of Object.entries(RHYME_GROUPS)) {
    // Check if word has a similar ending (last 2-3 characters match)
    const wordEnding = word.slice(-3)
    const endingStart = ending.slice(-3)
    
    if (wordEnding === endingStart && word !== ending) {
      // Add some words from this group as slant rhymes
      for (const rhymeWord of rhymeWords.slice(0, 5)) { // Limit to first 5
        if (rhymeWord !== word && isValidWord(rhymeWord)) {
          rhymes.push({
            word: rhymeWord,
            type: 'slant',
            score: calculateScore(word, rhymeWord, 'slant'),
            syllables: estimateSyllables(rhymeWord),
            source: 'local',
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
  
  // Bonus for being a common word
  const commonWordBonus = isCommonWord(candidate) ? 15 : 0
  
  const score = baseScore + lengthBonus + letterBonus + commonWordBonus
  return Math.min(100, Math.max(0, score))
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
  const vowels = word.match(VOWEL_GROUP_PATTERN)
  if (!vowels) return 1
  
  let count = vowels.length
  
  // Adjust for silent 'e'
  if (word.endsWith('e') && count > 1) count--
  
  // Adjust for diphthongs
  const diphthongs = word.match(/[aeiouy]{2,}/gi)
  if (diphthongs) count -= diphthongs.length - 1
  
  const result = Math.max(1, count)
  return isNaN(result) ? 1 : result
}

function isValidWord(word: string): boolean {
  // Basic validation - must be 2+ characters, only letters
  if (word.length < 2) return false
  if (!/^[a-z]+$/i.test(word)) return false
  
  // Must have at least one vowel
  return VOWEL_PRESENT_PATTERN.test(word)
}

function isCommonWord(word: string): boolean {
  // Check if word appears in any rhyme group (indicating it's a common word)
  for (const rhymeWords of Object.values(RHYME_GROUPS)) {
    if (rhymeWords.includes(word.toLowerCase())) {
      return true
    }
  }
  return false
}