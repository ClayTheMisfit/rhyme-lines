import { numberToWords } from '@/utils/numberToWords'

const NUMERIC_ONLY = /^\d+$/
const MERIDIEM_NORMALIZED = /^(\d{1,2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)$/i

export function normalizeTokenForSyllables(token: string): string {
  const normalized = token.trim()
  const lowered = normalized.toLowerCase()

  if (lowered === 'ina') return 'in a'

  const meridiemMatch = MERIDIEM_NORMALIZED.exec(lowered)
  if (meridiemMatch) {
    const hour = Number.parseInt(meridiemMatch[1], 10)
    if (Number.isFinite(hour) && hour >= 1 && hour <= 12) {
      const hourWords = numberToWords(hour)
      const suffix = meridiemMatch[2].startsWith('a') ? 'a m' : 'p m'
      return `${hourWords} ${suffix}`
    }
  }

  if (!NUMERIC_ONLY.test(normalized)) return normalized
  const numeric = Number.parseInt(normalized, 10)
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 9999) return normalized
  return numberToWords(numeric)
}
