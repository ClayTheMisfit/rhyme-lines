import { countSyllables } from '@/lib/nlp/syllables'

describe('countSyllables', () => {
  it('supports ina pronunciation normalization payload', () => {
    expect(countSyllables('in a')).toBe(2)
  })

  it('counts spoken am/pm syllables', () => {
    expect(countSyllables('ten p m')).toBe(3)
  })

  it('applies unknown compound suffix heuristic for vibeout', () => {
    expect(countSyllables('vibeout')).toBe(2)
  })

  it('does not over-split unknown suffix words without lexical signal', () => {
    expect(countSyllables('zillionover')).toBe(4)
  })
})
