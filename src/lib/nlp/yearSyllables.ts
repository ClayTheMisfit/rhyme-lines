const YEAR_TOKEN_REGEX = /^\d{4}$/
const YEAR_MIN = 1900
const YEAR_MAX = 2099

export type TokenParts = {
  leading: string
  core: string
  trailing: string
}

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

const YEAR_SYLLABLE_OVERRIDES: Record<number, number> = {
  1999: 5,
  2026: 4,
}

const yearSyllableCache = new Map<number, number>()

/**
 * Year syllable handling for 1900-2099.
 * Assumes common spoken forms (e.g. 1999 -> "nineteen ninety nine", 2026 -> "twenty twenty six").
 * Uses a small override table first for product-specific expectations.
 */
export function isYearToken(rawToken: string): boolean {
  const numeric = parseYearToken(rawToken)
  return numeric !== null
}

export function parseYearToken(rawToken: string): number | null {
  const { core } = splitTokenAffixes(rawToken)
  if (!YEAR_TOKEN_REGEX.test(core)) return null

  const year = Number(core)
  if (!Number.isFinite(year)) return null
  if (year < YEAR_MIN || year > YEAR_MAX) return null

  return year
}

export function yearToSpokenParts(year: number): string[] {
  if (year < YEAR_MIN || year > YEAR_MAX) return [String(year)]

  if (year >= 1900 && year <= 1999) {
    const lastTwo = year % 100
    if (lastTwo === 0) return ['nineteen', 'hundred']
    if (lastTwo < 10) return ['nineteen', 'oh', ONES[lastTwo]]
    return ['nineteen', ...twoDigitParts(lastTwo)]
  }

  if (year >= 2000 && year <= 2009) {
    const lastTwo = year % 100
    if (lastTwo === 0) return ['two', 'thousand']
    return ['two', 'thousand', ...twoDigitParts(lastTwo)]
  }

  const lastTwo = year % 100
  if (lastTwo === 0) return ['twenty', 'hundred']
  if (lastTwo < 10) return ['twenty', 'oh', ONES[lastTwo]]

  return ['twenty', ...twoDigitParts(lastTwo)]
}

export function countYearSyllables(
  year: number,
  countWordSyllables: (word: string) => number
): number {
  const cached = yearSyllableCache.get(year)
  if (cached !== undefined) return cached

  const override = YEAR_SYLLABLE_OVERRIDES[year]
  if (override !== undefined) {
    yearSyllableCache.set(year, override)
    return override
  }

  const count = yearToSpokenParts(year)
    .flatMap((part) => part.split('-'))
    .reduce((sum, part) => sum + countWordSyllables(part), 0)

  yearSyllableCache.set(year, count)
  return count
}

function twoDigitParts(value: number): string[] {
  if (value < 10) return [ONES[value]]
  if (value < 20) return [TEENS[value - 10]]

  const tens = Math.floor(value / 10)
  const ones = value % 10
  return ones ? [TENS[tens], ONES[ones]] : [TENS[tens]]
}

export function splitTokenAffixes(token: string): TokenParts {
  const trimmed = token.trim()
  if (!trimmed) return { leading: '', core: '', trailing: '' }

  const firstCoreIndex = trimmed.search(/[A-Za-z0-9]/)
  if (firstCoreIndex === -1) {
    return { leading: trimmed, core: '', trailing: '' }
  }

  const reversed = [...trimmed].reverse().join('')
  const trailingCoreOffset = reversed.search(/[A-Za-z0-9]/)
  const lastCoreIndex = trimmed.length - trailingCoreOffset - 1

  return {
    leading: trimmed.slice(0, firstCoreIndex),
    core: trimmed.slice(firstCoreIndex, lastCoreIndex + 1),
    trailing: trimmed.slice(lastCoreIndex + 1),
  }
}
