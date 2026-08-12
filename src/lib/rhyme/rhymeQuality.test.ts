/** @jest-environment node */
import { classifyIndexedRhymeQuality, normalizeRhymeMode } from './rhymeQuality'

const indexed = (perfect: string, vowel: string, coda: string) => ({
  perfectKeys: [perfect],
  vowelKeys: [vowel],
  codaKeys: [coda],
})

describe('rhyme quality classification', () => {
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
})
