import { analyzeProjectContent } from '@/lib/projects/analysis'
import { computeAnalysis } from '@/lib/analysis/compute'

describe('project analysis metrics', () => {
  it.each([
    ['a', 1],
    ['I', 1],
    ['1999', 5],
    ['12:05', 3],
    ['a learned scholar', 5],
    ["I’m learning", 3],
  ])('matches canonical editor syllables for %s', (content, expected) => {
    const canonical = computeAnalysis([{ id: 'line', text: content }]).lineTotals.line

    expect(canonical).toBe(expected)
    const project = analyzeProjectContent(content)
    expect(project.totalSyllables).toBe(canonical)
    expect(project.averageSyllablesPerLine).toBe(canonical)
  })

  it('does not treat internal rhymes in one line as an end-rhyme family', () => {
    const metrics = analyzeProjectContent('cat bat road')

    expect(metrics.endRhymeFamilyCount).toBe(0)
    expect(metrics.rhymeDensity).toBe(0)
  })

  it('counts repeated families from distinct line endings', () => {
    expect(analyzeProjectContent('I saw a cat\nHe swung the bat').endRhymeFamilyCount).toBe(1)
    expect(analyzeProjectContent([
      'I saw a cat',
      'He swung the bat',
      'I watched it glow',
      'Then came the snow',
    ].join('\n')).endRhymeFamilyCount).toBe(2)
  })

  it('uses every analyzable non-empty line ending as the density denominator', () => {
    expect(analyzeProjectContent('cat\nbat\ndog').rhymeDensity).toBeCloseTo(2 / 3)
    expect(analyzeProjectContent('cat\nbat\nthe').rhymeDensity).toBeCloseTo(2 / 3)
  })

  it('returns safe zero rhyme metrics for singleton and one-line endings', () => {
    expect(analyzeProjectContent('cat\ndog\ntree').rhymeDensity).toBe(0)
    expect(analyzeProjectContent('cat\ndog\ntree').endRhymeFamilyCount).toBe(0)
    expect(analyzeProjectContent('cat').rhymeDensity).toBe(0)
    expect(analyzeProjectContent('cat').endRhymeFamilyCount).toBe(0)
  })

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
    expect(metrics.endRhymeFamilyCount).toBe(1)
    expect(metrics.averageSyllablesPerLine).toBeGreaterThan(4)
  })

  it('returns zeroed metrics for empty content', () => {
    expect(analyzeProjectContent('')).toEqual({
      totalSyllables: 0,
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

  it('keeps renderer-filtered stopword endings in domain rhyme metrics', () => {
    const metrics = analyzeProjectContent(['will', 'still'].join('\n'))

    expect(metrics.rhymeDensity).toBe(1)
    expect(metrics.endRhymeFamilyCount).toBe(1)
  })

  it('uses canonical neighboring-word semantics for context-sensitive syllable counts', () => {
    expect(analyzeProjectContent('a learned scholar').averageSyllablesPerLine).toBe(5)
  })

  it('averages canonical totals over the established physical project line count', () => {
    const metrics = analyzeProjectContent('cat\n\nbat')

    expect(metrics.totalSyllables).toBe(2)
    expect(metrics.averageSyllablesPerLine).toBeCloseTo(2 / 3)
    expect(metrics.rhymeDensity).toBe(1)
  })

  it('counts only repeated line-ending families for the dense reference block', () => {
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

    expect(metrics.endRhymeFamilyCount).toBe(4)
  })
})
