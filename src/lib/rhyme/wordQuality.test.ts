import { classifyCandidate } from './wordQuality'

describe('rhyme lexical quality', () => {
  test.each(['petr', 'zain', 'layne', 'hayne', 'kane', 'maine', 'kain', 'raine', 'shayne'])(
    'classifies name-only candidate %s as proper',
    (word) => expect(classifyCandidate(word).qualityTier).toBe('proper')
  )

  test.each(['rain', 'rose', 'hope', 'grace', 'will', 'mark', 'summer', 'hunter', 'chase'])(
    'keeps ordinary name collision %s eligible',
    (word) => expect(classifyCandidate(word).qualityTier).not.toBe('proper')
  )

  test('does not treat capitalization alone as proper-name evidence for ordinary words', () => {
    expect(classifyCandidate('Rose').qualityTier).not.toBe('proper')
    expect(classifyCandidate('ROSE').qualityTier).not.toBe('proper')
    expect(classifyCandidate('Getter').qualityTier).not.toBe('proper')
  })

  test('separates pronunciation/frequency presence from ordinary-word evidence', () => {
    expect(classifyCandidate('petr', { frequency: 0 }).qualityTier).toBe('proper')
    expect(classifyCandidate('zain', { frequency: 42 }).qualityTier).toBe('proper')
    expect(classifyCandidate('petr', { frequency: 2, tags: ['n'] }).qualityTier).not.toBe('proper')
  })

  test('handles missing frequency as neutral without inventing name evidence', () => {
    expect(classifyCandidate('letter').qualityTier).not.toBe('proper')
    expect(classifyCandidate('petr').qualityTier).toBe('proper')
    expect(classifyCandidate('quern').qualityTier).not.toBe('proper')
  })

  test.each(['Shayne', 'shayne', 'SHAYNE'])('name evidence is case invariant for %s', (word) => {
    expect(classifyCandidate(word).isProper).toBe(true)
  })

  test('modern lexical evidence wins over name-list membership', () => {
    expect(classifyCandidate('Grace', { frequency: 20, tags: ['n'] }).isProper).toBe(false)
  })
})
