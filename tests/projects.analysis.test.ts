import { analyzeProjectContent } from '@/lib/projects/analysis'

describe('project analysis metrics', () => {
  it('returns stable deterministic metrics for a known sample', () => {
    const lyrics = [
      'Night light in the city glow',
      'I write tight when the rhythms flow',
      'Inside lines collide with hidden chimes',
      'I glow and flow through midnight rhymes',
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
