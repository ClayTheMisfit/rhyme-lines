/** @jest-environment node */
import { buildVisibleSuggestions, DEFAULT_SUGGESTION_CAP } from '@/components/rhyme/buildVisibleSuggestions'

describe('buildVisibleSuggestions', () => {
  it('returns the full set when under the cap', () => {
    const suggestions = Array.from({ length: 95 }, (_, index) => `word-${index}`)
    const visible = buildVisibleSuggestions(suggestions, DEFAULT_SUGGESTION_CAP)
    expect(visible).toHaveLength(95)
  })

  it('caps results when over the limit', () => {
    const suggestions = Array.from({ length: 600 }, (_, index) => `word-${index}`)
    const visible = buildVisibleSuggestions(suggestions, 500)
    expect(visible).toHaveLength(500)
  })
})
