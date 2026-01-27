import { isEnglishWord } from '@/lib/rhyme-db/isEnglishWord'

describe('isEnglishWord', () => {
  it('filters known non-English tokens', () => {
    expect(isEnglishWord('crime')).toBe(true)
    expect(isEnglishWord('sublime')).toBe(true)
    expect(isEnglishWord('hochzeit')).toBe(false)
  })

  it('normalizes casing and punctuation', () => {
    expect(isEnglishWord('Time')).toBe(true)
    expect(isEnglishWord('crime,')).toBe(true)
    expect(isEnglishWord('Sublime!')).toBe(true)
    expect(isEnglishWord('hochzeit')).toBe(false)
  })

  it('returns consistent results across repeated calls', () => {
    expect(isEnglishWord('crime')).toBe(true)
    expect(isEnglishWord('crime')).toBe(true)
    expect(isEnglishWord('hochzeit')).toBe(false)
    expect(isEnglishWord('hochzeit')).toBe(false)
  })
})
