import { normalizeLexeme } from '@/lib/rhyme-db/normalizeLexeme'

describe('normalizeLexeme', () => {
  it('normalizes CMUdict tokens and filters invalid lexemes', () => {
    expect(normalizeLexeme('ROB')).toBe('rob')
    expect(normalizeLexeme('ROB(1)')).toBe('rob')
    expect(normalizeLexeme('baab')).toBe('baab')
    expect(normalizeLexeme('123')).toBe('')
    expect(normalizeLexeme('co-op')).toBe('')
    expect(normalizeLexeme("don't")).toBe("don't")
    expect(normalizeLexeme('b')).toBe('')
    expect(normalizeLexeme('rhythms')).toBe('rhythms')
    expect(normalizeLexeme('brrr')).toBe('')
  })
})
