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

  it.each(['waves', 'waves...', '“waves”', 'waves!'])('ignores punctuation and silent e in %s', (word) => {
    expect(countSyllables(word)).toBe(1)
  })

  it.each(['survived', 'survived,', 'survived;'])('derives regular past tense pronunciation for %s', (word) => {
    expect(countSyllables(word)).toBe(2)
  })

  it.each(['wishes', 'pushes', 'branches'])('keeps the spoken sibilant plural ending in %s', (word) => {
    expect(countSyllables(word)).toBe(2)
  })

  it.each(['tables', 'apples', 'peoples'])('applies the full singular fallback to %s', (word) => {
    expect(countSyllables(word)).toBe(2)
  })

  it.each([
    ['movies', 2],
    ['cookies', 2],
    ['pies', 1],
    ['zombies', 2],
  ])('does not add a syllable to an -ie base in %s', (word, expected) => {
    expect(countSyllables(word)).toBe(expected)
  })

  it.each(['sacred', 'hatred', 'wretched', 'rugged'])('does not treat lexical -ed ending in %s as an inflection', (word) => {
    expect(countSyllables(word)).toBe(2)
  })

  it('distinguishes the common verb and adjective pronunciations of learned', () => {
    expect(countSyllables('learned')).toBe(1)
    expect(countSyllables('learned', { previousWord: 'a', nextWord: 'scholar' })).toBe(2)
  })

  it.each(["I'm", 'I’m'])('normalizes apostrophes in %s', (word) => {
    expect(countSyllables(word)).toBe(1)
  })
})
