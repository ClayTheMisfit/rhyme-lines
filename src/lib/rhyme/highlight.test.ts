import { buildHighlightGroups, computeRhymeKey, stableHash, type RhymeToken } from '@/lib/rhyme/highlight'

describe('computeRhymeKey', () => {
  it('returns phoneme keys when available', () => {
    const cache = new Map()
    const resolver = { getPerfectKey: (normalized: string) => (normalized === 'time' ? 'AY-M' : null) }
    const result = computeRhymeKey('time', resolver, cache)
    expect(result).toEqual({ key: 'AY-M', source: 'phoneme' })
  })

  it('falls back to orthographic tail when phonemes are missing', () => {
    const cache = new Map()
    const resolver = { getPerfectKey: () => null }
    const result = computeRhymeKey('apple', resolver, cache)
    expect(result).toEqual({ key: 'ortho:pple', source: 'ortho' })
  })
})

describe('buildHighlightGroups', () => {
  it('only builds groups with at least two tokens', () => {
    const tokens: RhymeToken[] = [
      { id: 't1', lineId: 'line-1', start: 0, end: 4, text: 'time', norm: 'time' },
      { id: 't2', lineId: 'line-2', start: 0, end: 4, text: 'rhyme', norm: 'rhyme' },
      { id: 't3', lineId: 'line-3', start: 0, end: 4, text: 'time', norm: 'time' },
    ]
    const resolver = { getPerfectKey: (normalized: string) => (normalized === 'time' ? 'AY-M' : null) }
    const result = buildHighlightGroups(tokens, { includeExactRepeats: false, resolver })
    expect(result.groups).toEqual([
      { rhymeKey: 'AY-M', tokenIds: ['t1', 't3'], kind: 'perfect' },
    ])
  })

  it('groups deterministically based on keys', () => {
    const tokens: RhymeToken[] = [
      { id: 't1', lineId: 'line-1', start: 0, end: 4, text: 'time', norm: 'time' },
      { id: 't2', lineId: 'line-1', start: 5, end: 9, text: 'dime', norm: 'dime' },
      { id: 't3', lineId: 'line-2', start: 0, end: 4, text: 'time', norm: 'time' },
      { id: 't4', lineId: 'line-2', start: 5, end: 9, text: 'dime', norm: 'dime' },
    ]
    const resolver = {
      getPerfectKey: (normalized: string) => (normalized === 'time' || normalized === 'dime' ? 'AY-M' : null),
    }
    const result = buildHighlightGroups(tokens, { includeExactRepeats: false, resolver })
    expect(result.groups[0]?.tokenIds).toEqual(['t1', 't2', 't3', 't4'])
  })
})

describe('stableHash', () => {
  it('returns stable values for the same key', () => {
    const first = stableHash('rhyme:time')
    const second = stableHash('rhyme:time')
    expect(first).toBe(second)
  })

  it('returns different values for different keys (basic sanity)', () => {
    const first = stableHash('rhyme:time')
    const second = stableHash('rhyme:dime')
    expect(first).not.toBe(second)
  })
})
