/** @jest-environment node */
import { classifyCandidate, DEFAULT_RHYME_LEXICAL_SCORE } from './wordQuality'

describe('rhyme lexical quality', () => {
  it('classifies proper-name-only dictionary entries from general name evidence', () => {
    expect(classifyCandidate('stuart').qualityTier).toBe('proper')
    expect(classifyCandidate('michael').qualityTier).toBe('proper')
  })

  it.each(['will', 'mark'])('retains %s when ordinary-word evidence overrides name use', (word) => {
    expect(classifyCandidate(word).qualityTier).not.toBe('proper')
  })

  it('exposes the default lexical-evidence floor used by local rhyme generation', () => {
    expect(classifyCandidate('porte').commonScore).toBeLessThan(DEFAULT_RHYME_LEXICAL_SCORE)
    expect(classifyCandidate('short').commonScore).toBeGreaterThan(DEFAULT_RHYME_LEXICAL_SCORE)
  })
})
