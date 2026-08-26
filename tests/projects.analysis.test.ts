import { analyzeProjectContent } from '@/lib/projects/analysis'

describe('project analysis metrics', () => {
  it('returns stable deterministic metrics for a known sample', () => {
    const lyrics = [
      'Night light in the city glow',
      'I write tight when the rhythms flow',
      'Inside lines collide with hidden chimes',
      'I glow and flow through midnight road',
    ].join('\n')

    const metrics = analyzeProjectContent(lyrics)

    expect(metrics.rhymeDensity).toBeCloseTo(0.5, 2)
    expect(metrics.internalRhymes).toBeGreaterThanOrEqual(1)
    expect(metrics.endRhymeFamilyCount).toBeGreaterThanOrEqual(2)
    expect(metrics.averageSyllablesPerLine).toBeGreaterThan(4)
  })

  it('returns zeroed metrics for empty content', () => {
    expect(analyzeProjectContent('')).toEqual({
      rhymeDensity: 0,
      internalRhymes: 0,
      endRhymeFamilyCount: 0,
      averageSyllablesPerLine: 0,
    })
  })

  it('returns zero density when no line endings rhyme', () => {
    expect(analyzeProjectContent(['cat', 'glow', 'deep', 'road'].join('\n')).rhymeDensity).toBe(0)
  })

  it('counts one repeated pair among four valid endings', () => {
    expect(analyzeProjectContent(['cat', 'bat', 'glow', 'road'].join('\n')).rhymeDensity).toBe(0.5)
  })

  it('returns full density when every ending participates in a repeated family', () => {
    expect(analyzeProjectContent(['cat', 'bat', 'glow', 'snow'].join('\n')).rhymeDensity).toBe(1)
  })

  it('excludes blank lines from the denominator', () => {
    expect(analyzeProjectContent(['cat', '', 'bat', '', 'road'].join('\n')).rhymeDensity).toBeCloseTo(2 / 3)
  })

  it('normalizes punctuation around line endings', () => {
    expect(analyzeProjectContent(['cat!', 'bat,', 'glow.', 'road?'].join('\n')).rhymeDensity).toBe(0.5)
  })

  it('excludes filtered stopword endings from rhyme density', () => {
    const metrics = analyzeProjectContent(['will', 'still'].join('\n'))

    expect(metrics.rhymeDensity).toBe(0)
    expect(metrics.endRhymeFamilyCount).toBe(0)
  })

  it('uses neighboring words for context-sensitive syllable counts', () => {
    expect(analyzeProjectContent('a learned scholar').averageSyllablesPerLine).toBe(4)
  })

  it('counts only repeated visible rhyme families for the dense reference block', () => {
    const lyrics = [
      'tag bag flag rag gag wag',
      'mat cat hat rat',
      'time fine rhyme',
      'glow snow show',
      'stone alone phone',
      'light night sight',
      'keep deep sleep',
      'crash ash stash',
      'Glow, SNOW, show!',
      'Phone, alone? STONE!',
      'tag home sleep car',
      'stone crash deep mat',
      '1999 was wild',
      '2001 felt strange',
      '2026 looks bright',
      "11 o'clock at night",
      '12:05 in the morning',
      '24/7 on my mind',
    ].join('\n')

    const metrics = analyzeProjectContent(lyrics)

    expect(metrics.endRhymeFamilyCount).toBe(8)
  })
})
