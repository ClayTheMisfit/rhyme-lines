import { tokenizeLine } from '@/lib/analysis/tokenize'
import { countSyllables } from '@/lib/nlp/syllables'
import { countYearSyllables, isYearToken, parseYearToken, yearToSpokenParts } from '@/lib/nlp/yearSyllables'
import { normalizeTokenForSyllables } from '@/lib/analysis/normalizeTokenForSyllables'

describe('year syllable handling', () => {
  it('recognizes year tokens with surrounding punctuation', () => {
    expect(isYearToken('1999')).toBe(true)
    expect(isYearToken('(1999)')).toBe(true)
    expect(isYearToken('2026,')).toBe(true)
  })

  it('enforces year range guardrails', () => {
    expect(isYearToken('2099')).toBe(true)
    expect(isYearToken('2100')).toBe(false)
    expect(isYearToken('0999')).toBe(false)
    expect(parseYearToken('173')).toBeNull()
  })

  it('returns expected spoken forms and syllable counts for target years', () => {
    expect(yearToSpokenParts(1999)).toEqual(['nineteen', 'ninety', 'nine'])
    expect(yearToSpokenParts(2026)).toEqual(['twenty', 'twenty', 'six'])
    expect(countYearSyllables(1999, countSyllables)).toBe(5)
    expect(countYearSyllables(2026, countSyllables)).toBe(4)
    expect(countSyllables('1999')).toBe(5)
    expect(countSyllables('(1999)')).toBe(5)
    expect(countSyllables('2026')).toBe(4)
    expect(countSyllables('2026,')).toBe(4)
  })

  it('keeps non-year numeric behavior unchanged', () => {
    expect(normalizeTokenForSyllables('173')).toBe('one hundred seventy three')
    expect(normalizeTokenForSyllables('999')).toBe('nine hundred ninety nine')
  })

  it('keeps 4-digit year tokenization as single tokens', () => {
    expect(tokenizeLine('1999 2026')).toEqual([
      { start: 0, end: 4, text: '1999', kind: 'word' },
      { start: 5, end: 9, text: '2026', kind: 'word' },
    ])
  })

  it('debug harness: exposes token + per-token syllables for year inputs', () => {
    const tokens = tokenizeLine('1999 2026')
    const details = tokens.map((token) => ({
      text: token.text,
      normalized: normalizeTokenForSyllables(token.text),
      spoken: yearToSpokenParts(Number.parseInt(token.text, 10)).join(' '),
      syllables: countSyllables(normalizeTokenForSyllables(token.text)),
    }))

    expect(details).toEqual([
      { text: '1999', normalized: '1999', spoken: 'nineteen ninety nine', syllables: 5 },
      { text: '2026', normalized: '2026', spoken: 'twenty twenty six', syllables: 4 },
    ])
  })
})
