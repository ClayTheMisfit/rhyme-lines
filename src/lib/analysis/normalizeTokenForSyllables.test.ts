import { normalizeTokenForSyllables } from './normalizeTokenForSyllables'
import { numberToWords } from '@/utils/numberToWords'

describe('numberToWords', () => {
  it('converts numbers to lowercase words', () => {
    expect(numberToWords(7)).toBe('seven')
    expect(numberToWords(11)).toBe('eleven')
    expect(numberToWords(20)).toBe('twenty')
    expect(numberToWords(42)).toBe('forty two')
    expect(numberToWords(100)).toBe('one hundred')
    expect(numberToWords(101)).toBe('one hundred one')
    expect(numberToWords(110)).toBe('one hundred ten')
    expect(numberToWords(115)).toBe('one hundred fifteen')
    expect(numberToWords(999)).toBe('nine hundred ninety nine')
    expect(numberToWords(1000)).toBe('one thousand')
    expect(numberToWords(2024)).toBe('two thousand twenty four')
    expect(numberToWords(9999)).toBe('nine thousand nine hundred ninety nine')
  })
})

describe('normalizeTokenForSyllables', () => {
  it('normalizes numeric tokens into words', () => {
    expect(normalizeTokenForSyllables('7')).toBe('seven')
    expect(normalizeTokenForSyllables('007')).toBe('seven')
  })

  it('leaves non-numeric tokens unchanged', () => {
    expect(normalizeTokenForSyllables('time')).toBe('time')
    expect(normalizeTokenForSyllables('7pm')).toBe('7pm')
    expect(normalizeTokenForSyllables('7.5')).toBe('7.5')
  })
})
