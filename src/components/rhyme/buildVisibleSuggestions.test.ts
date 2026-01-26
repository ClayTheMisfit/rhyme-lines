/** @jest-environment node */
import { buildVisibleSuggestions } from '@/components/rhyme/buildVisibleSuggestions'

describe('buildVisibleSuggestions', () => {
  it('returns the full set', () => {
    const suggestions = Array.from({ length: 95 }, (_, index) => `word-${index}`)
    const visible = buildVisibleSuggestions(suggestions)
    expect(visible).toHaveLength(95)
  })

  it('does not cap larger result sets', () => {
    const suggestions = Array.from({ length: 600 }, (_, index) => `word-${index}`)
    const visible = buildVisibleSuggestions(suggestions)
    expect(visible).toHaveLength(600)
  })
})
