import commonWordRanks from '@/lib/rhyme-db/frequency/commonWordRanks.json'
import { isCommonEnglishWord } from '@/lib/rhyme-db/commonEnglish'

const ENGLISH_WORD_RANKS = commonWordRanks as Record<string, number>
const ENGLISH_WORD_CACHE = new Map<string, boolean>()

export const isEnglishWord = (word: string): boolean => {
  const normalized = word.toLowerCase().replace(/^[^a-z'-]+|[^a-z'-]+$/g, '')
  const cached = ENGLISH_WORD_CACHE.get(normalized)
  if (cached !== undefined) {
    return cached
  }
  const isValid = /^[a-z'-]+$/.test(normalized)
  const isEnglish =
    isValid && (isCommonEnglishWord(normalized) || Object.prototype.hasOwnProperty.call(ENGLISH_WORD_RANKS, normalized))
  ENGLISH_WORD_CACHE.set(normalized, isEnglish)
  return isEnglish
}
