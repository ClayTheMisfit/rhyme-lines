import { normalizeTokenForSyllables } from '@/lib/analysis/normalizeTokenForSyllables'
import { numberToWords } from '@/utils/numberToWords'

describe('numberToWords', () => {
  it('converts numbers 0-9999 to words', () => {
    expect(numberToWords(0)).toBe('zero')
    expect(numberToWords(7)).toBe('seven')
    expect(numberToWords(11)).toBe('eleven')
    expect(numberToWords(20)).toBe('twenty')
    expect(numberToWords(42)).toBe('forty two')
    expect(numberToWords(99)).toBe('ninety nine')
    expect(numberToWords(100)).toBe('one hundred')
    expect(numberToWords(101)).toBe('one hundred one')
    expect(numberToWords(115)).toBe('one hundred fifteen')
    expect(numberToWords(999)).toBe('nine hundred ninety nine')
    expect(numberToWords(1000)).toBe('one thousand')
    expect(numberToWords(2024)).toBe('two thousand twenty four')
    expect(numberToWords(9999)).toBe('nine thousand nine hundred ninety nine')
  })
})

describe('normalizeTokenForSyllables', () => {
  it('normalizes numeric-only tokens to words', () => {
    expect(normalizeTokenForSyllables('7')).toBe('seven')
    expect(normalizeTokenForSyllables('42')).toBe('forty two')
    expect(normalizeTokenForSyllables('007')).toBe('seven')
  })


  it('keeps 4-digit years numeric for dedicated year syllable handling', () => {
    expect(normalizeTokenForSyllables('1999')).toBe('1999')
    expect(normalizeTokenForSyllables('2026')).toBe('2026')
    expect(normalizeTokenForSyllables('(1999)')).toBe('1999')
    expect(normalizeTokenForSyllables('2026,')).toBe('2026')
  })

  it('normalizes ina as in a pronunciation', () => {
    expect(normalizeTokenForSyllables('ina')).toBe('in a')
    expect(normalizeTokenForSyllables('INA')).toBe('in a')
  })

  it('normalizes standalone am/pm variants to spoken forms', () => {
    expect(normalizeTokenForSyllables('10 pm')).toBe('ten p m')
    expect(normalizeTokenForSyllables('1a.m.')).toBe('one a m')
    expect(normalizeTokenForSyllables('12PM')).toBe('twelve p m')
    expect(normalizeTokenForSyllables('13 pm')).toBe('13 pm')
  })

  it('leaves unrelated tokens unchanged', () => {
    expect(normalizeTokenForSyllables('7pm')).toBe('seven p m')
    expect(normalizeTokenForSyllables('7.5')).toBe('7.5')
    expect(normalizeTokenForSyllables('time')).toBe('time')
  })
})
