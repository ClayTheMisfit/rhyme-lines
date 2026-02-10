import { isStopword, normalizeStopword } from '@/lib/nlp/stopwords'

describe('stopwords', () => {
  it('normalizes punctuation and case', () => {
    expect(normalizeStopword('The')).toBe('the')
    expect(normalizeStopword('and,')).toBe('and')
    expect(normalizeStopword('...to...')).toBe('to')
  })

  it('detects common stopwords', () => {
    expect(isStopword('the')).toBe(true)
    expect(isStopword('and')).toBe(true)
    expect(isStopword('with')).toBe(true)
  })

  it('returns false for non-stopwords', () => {
    expect(isStopword('rhyme')).toBe(false)
    expect(isStopword('cat')).toBe(false)
  })
})
