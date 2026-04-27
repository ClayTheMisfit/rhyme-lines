/** @jest-environment node */
import { buildVisibleSuggestions } from '@/components/rhyme/buildVisibleSuggestions'

describe('buildVisibleSuggestions', () => {
  it('returns the full set when no cap is provided', () => {
    const suggestions = Array.from({ length: 95 }, (_, index) => `word-${index}`)
    const visible = buildVisibleSuggestions(suggestions)
    expect(visible).toHaveLength(95)
  })

  it('caps larger result sets when a limit is provided', () => {
    const suggestions = Array.from({ length: 600 }, (_, index) => `word-${index}`)
    const visible = buildVisibleSuggestions(suggestions, { limit: 8 })
    expect(visible).toHaveLength(8)
  })

  it('deduplicates suggestions by normalized value', () => {
    const visible = buildVisibleSuggestions(['Time', 'time', 'rhyme', 'Rhyme', ''])
    expect(visible).toEqual(['Time', 'rhyme'])
  })
})
