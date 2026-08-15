/** @jest-environment node */
import {
  classifyIndexedRhymeQuality,
  normalizeRhymeMode,
  scoreIndexedRhymeSimilarity,
  SLANT_MIN_COMBINED_SIMILARITY,
} from './rhymeQuality'
import { vowelRankingSimilarity } from '@/lib/rhyme-db/arpabetFeatures'

const indexed = (perfect: string, vowel: string, coda: string) => ({
  perfectKeys: [perfect],
  vowelKeys: [vowel],
  codaKeys: [coda],
})

describe('rhyme quality classification', () => {
  it('orders closing-diphthong and monophthong distances without changing broad classification', () => {
    expect(vowelRankingSimilarity('EY', 'AY')).toBeGreaterThan(vowelRankingSimilarity('EY', 'IY'))
    expect(vowelRankingSimilarity('EY', 'IY')).toBeGreaterThan(vowelRankingSimilarity('EY', 'EH'))

    // The intrinsic classifier deliberately retains its established broad
    // feature score; the finer trajectory model is ranking-only.
    expect(scoreIndexedRhymeSimilarity(indexed('EY-N', 'EY', 'N'), indexed('AY-N', 'AY', 'N')).vowel).toBe(0.75)
    expect(classifyIndexedRhymeQuality(indexed('EY-N', 'EY', 'N'), indexed('AY-N', 'AY', 'N'))).toBe('slant')
  })
  it.each([
    ['Perfect', 'perfect'],
    ['Near', 'near'],
    ['Slant', 'slant'],
  ] as const)('normalizes %s without narrowing away a supported mode', (mode, expected) => {
    expect(normalizeRhymeMode(mode)).toBe(expected)
  })

  it('creates mutually exclusive perfect, near, and slant tiers', () => {
    const night = indexed('AY-T', 'AY', 'T')
    expect(classifyIndexedRhymeQuality(night, indexed('AY-T', 'AY', 'T'))).toBe('perfect')
    expect(classifyIndexedRhymeQuality(night, indexed('AY-D', 'AY', 'D'))).toBe('near')
    expect(classifyIndexedRhymeQuality(night, indexed('EH-T', 'EH', 'T'))).toBe('slant')
    expect(classifyIndexedRhymeQuality(night, indexed('UW-M', 'UW', 'M'))).toBeNull()
  })

  it('requires compatible vowel and coda evidence for slant rhymes', () => {
    const heart = indexed('AA-R-T', 'AA', 'R-T')

    expect(classifyIndexedRhymeQuality(heart, indexed('AO-R-T', 'AO', 'R-T'))).toBe('slant')
    expect(classifyIndexedRhymeQuality(heart, indexed('EH-R-T', 'EH', 'R-T'))).toBeNull()
    expect(classifyIndexedRhymeQuality(heart, indexed('AA-M', 'AA', 'M'))).toBeNull()
    expect(classifyIndexedRhymeQuality(heart, indexed('UW-M', 'UW', 'M'))).toBeNull()
  })

  it('keeps score bands reachable and non-overlapping at their canonical boundaries', () => {
    const heart = indexed('AA-R-T', 'AA', 'R-T')
    const short = indexed('AO-R-T', 'AO', 'R-T')
    const similarity = scoreIndexedRhymeSimilarity(heart, short)

    expect(similarity).toEqual({ vowel: 0.5, coda: 1, combined: 0.675 })
    expect(similarity.combined).toBeGreaterThanOrEqual(SLANT_MIN_COMBINED_SIMILARITY)
    expect(classifyIndexedRhymeQuality(heart, short)).toBe('slant')
    expect(classifyIndexedRhymeQuality(heart, indexed('AA-R-D', 'AA', 'R-D'))).toBe('near')
    expect(classifyIndexedRhymeQuality(heart, heart)).toBe('perfect')
  })
})
