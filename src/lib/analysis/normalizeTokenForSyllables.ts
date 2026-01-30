import { numberToWords } from '@/utils/numberToWords'

const NUMERIC_ONLY = /^\d+$/

export function normalizeTokenForSyllables(token: string): string {
  if (!NUMERIC_ONLY.test(token)) return token
  const numeric = Number.parseInt(token, 10)
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 9999) return token
  return numberToWords(numeric)
}
