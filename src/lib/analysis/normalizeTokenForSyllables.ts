import { numberToWords } from '@/utils/numberToWords'

const NUMERIC_ONLY = /^\d+$/

export const normalizeTokenForSyllables = (token: string): string => {
  if (!NUMERIC_ONLY.test(token)) return token
  const value = Number(token)
  if (!Number.isFinite(value) || value < 0 || value > 9999) return token
  return numberToWords(value)
}
