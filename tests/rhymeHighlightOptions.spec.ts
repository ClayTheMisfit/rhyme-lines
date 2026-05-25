import { resolveInternalRhymesEnabled } from '@/lib/rhyme/highlightOptions'

describe('resolveInternalRhymesEnabled', () => {
  test('keeps explicit internal-rhyme preference when enabled', () => {
    expect(resolveInternalRhymesEnabled(true, 'end')).toBe(true)
    expect(resolveInternalRhymesEnabled(true, 'focus')).toBe(true)
  })

  test('forces internal rhyme grouping for all-mode rendering', () => {
    expect(resolveInternalRhymesEnabled(false, 'all')).toBe(true)
  })

  test('respects disabled internal rhymes for non-all modes', () => {
    expect(resolveInternalRhymesEnabled(false, 'off')).toBe(false)
    expect(resolveInternalRhymesEnabled(false, 'end')).toBe(false)
    expect(resolveInternalRhymesEnabled(false, 'focus')).toBe(false)
  })
})
