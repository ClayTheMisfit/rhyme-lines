import { normalizeTokenForSyllables } from '@/lib/analysis/normalizeTokenForSyllables'

describe('normalizeTokenForSyllables', () => {
  it('keeps punctuation and casing variants equivalent for syllable analysis', () => {
    expect(normalizeTokenForSyllables('Glow,')).toBe('Glow,')
    expect(normalizeTokenForSyllables('SNOW.')).toBe('SNOW.')
    expect(normalizeTokenForSyllables('show!')).toBe('show!')
  })

  it('normalizes years into year-aware spoken inputs', () => {
    expect(normalizeTokenForSyllables('1999')).toBe('1999')
    expect(normalizeTokenForSyllables('2001')).toBe('2001')
    expect(normalizeTokenForSyllables('2026')).toBe('2026')
  })

  it('normalizes times and compact numeric expressions into spoken forms', () => {
    expect(normalizeTokenForSyllables("11 o'clock")).toBe("11 o'clock")
    expect(normalizeTokenForSyllables('12:05')).toBe('twelve oh five')
    expect(normalizeTokenForSyllables('24/7')).toBe('twenty four seven')
  })
})
