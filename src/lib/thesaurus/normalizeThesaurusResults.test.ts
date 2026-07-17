import { normalizeThesaurusResults } from '@/lib/thesaurus/normalizeThesaurusResults'
import type { RawThesaurusConcept } from '@/lib/thesaurus/types'

const raw = (word: string, relationship: RawThesaurusConcept['relationship'], score = 1): RawThesaurusConcept => ({
  word,
  relationship,
  score,
  source: 'datamuse',
})

describe('normalizeThesaurusResults', () => {
  it('trims, dedupes, filters seed and unusable values, and keeps synonym precedence', () => {
    const result = normalizeThesaurusResults(' Dream ', [
      raw(' vision ', 'related', 10),
      raw('Vision', 'synonym', 5),
      raw('dream', 'synonym', 99),
      raw('big idea', 'synonym', 50),
      raw('!!!', 'related', 50),
      raw('', 'related', 50),
      raw('goal', 'related', 8),
    ])

    expect(result.target).toBe('dream')
    expect(result.concepts.map((concept) => concept.normalizedWord)).toEqual(['vision', 'goal'])
    expect(result.concepts[0]).toMatchObject({ word: 'Vision', relationship: 'synonym', score: 10 })
    expect(result.synonyms).toHaveLength(1)
    expect(result.related).toHaveLength(1)
  })

  it('sorts deterministically by relationship, score, frequency, then word and enforces limits', () => {
    const result = normalizeThesaurusResults('time', [
      raw('future', 'related', 7),
      { ...raw('vision', 'synonym', 3), frequency: 1 },
      { ...raw('ambition', 'synonym', 3), frequency: 2 },
      raw('goal', 'related', 7),
      raw('moment', 'related', 9),
      raw('era', 'related', 8),
      raw('age', 'related', 8),
      raw('period', 'related', 8),
      raw('season', 'related', 8),
      raw('hour', 'related', 8),
      raw('day', 'related', 8),
      raw('night', 'related', 8),
      raw('year', 'related', 8),
      raw('week', 'related', 8),
      raw('month', 'related', 8),
      raw('clock', 'related', 8),
    ])

    expect(result.synonyms.map((concept) => concept.normalizedWord)).toEqual(['ambition', 'vision'])
    expect(result.related).toHaveLength(12)
    expect(result.concepts).toHaveLength(14)
    expect(result.related[0].normalizedWord).toBe('moment')
  })
})
