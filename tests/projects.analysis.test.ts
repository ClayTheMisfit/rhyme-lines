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
})
