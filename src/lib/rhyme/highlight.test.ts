import { buildHighlightGroups, computeRhymeKey, getTokenHighlightStyle, stableHash, type RhymeToken } from '@/lib/rhyme/highlight'

describe('computeRhymeKey', () => {
  it('returns phoneme keys when available', () => {
    const cache = new Map()
    const resolver = { getPerfectKey: (normalized: string) => (normalized === 'time' ? 'AY-M' : null) }
    const result = computeRhymeKey('time', resolver, cache)
    expect(result).toEqual({ key: 'AY-M', source: 'phoneme' })
  })

  it('returns null when phonemes are missing', () => {
    const cache = new Map()
    const resolver = { getPerfectKey: () => null }
    const result = computeRhymeKey('apple', resolver, cache)
    expect(result).toEqual({ key: null, source: 'none' })
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
      { key: 'rhyme:AY-M', tokenIds: ['t1', 't3'], kind: 'perfect', order: 0 },
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

describe('buildHighlightGroups unknown words', () => {
  const tokens: RhymeToken[] = [
    { id: 't1', lineId: 'line-1', start: 0, end: 5, text: 'qwerk', norm: 'qwerk' },
    { id: 't2', lineId: 'line-1', start: 6, end: 11, text: 'qwerk', norm: 'qwerk' },
  ]

  it('keeps unknown words as exact repeats only when enabled', () => {
    const resolver = { getPerfectKey: () => null }
    const result = buildHighlightGroups(tokens, { includeExactRepeats: true, resolver })
    expect(result.groups).toEqual([{ key: 'exact:qwerk', tokenIds: ['t1', 't2'], kind: 'exact', order: 0 }])
    expect(getTokenHighlightStyle('t1', result.groups)).toBe('underline')
  })

  it('does not highlight unknown words without exact repeats', () => {
    const resolver = { getPerfectKey: () => null }
    const result = buildHighlightGroups(tokens, { includeExactRepeats: false, resolver })
    expect(result.groups).toEqual([])
  })
})

describe('buildHighlightGroups stopwords', () => {
  const tokens: RhymeToken[] = [
    { id: 't1', lineId: 'line-1', start: 0, end: 3, text: 'the', norm: 'the' },
    { id: 't2', lineId: 'line-1', start: 4, end: 7, text: 'cat', norm: 'cat' },
    { id: 't3', lineId: 'line-1', start: 8, end: 10, text: 'in', norm: 'in' },
    { id: 't4', lineId: 'line-1', start: 11, end: 14, text: 'the', norm: 'the' },
    { id: 't5', lineId: 'line-1', start: 15, end: 18, text: 'hat', norm: 'hat' },
  ]
  const resolver = {
    getPerfectKey: (normalized: string) => (normalized === 'cat' || normalized === 'hat' ? 'AE-T' : null),
  }

  it('includes stopwords when ignoreStopwords is off', () => {
    const result = buildHighlightGroups(tokens, { includeExactRepeats: true, ignoreStopwords: false, resolver })
    const keys = result.groups.map((group) => group.key)
    expect(keys).toContain('exact:the')
    expect(keys).toContain('rhyme:AE-T')
  })

  it('filters stopwords when ignoreStopwords is on', () => {
    const result = buildHighlightGroups(tokens, { includeExactRepeats: true, ignoreStopwords: true, resolver })
    const keys = result.groups.map((group) => group.key)
    expect(keys).not.toContain('exact:the')
    expect(keys).not.toContain('rhyme:the')
    expect(keys).toContain('rhyme:AE-T')
  })
})

describe('getTokenHighlightStyle', () => {
  it('returns pill for perfect groups', () => {
    const groups = [
      { key: 'rhyme:AY-M', tokenIds: ['t1'], kind: 'perfect' as const, order: 0 },
      { key: 'exact:time', tokenIds: ['t1'], kind: 'exact' as const, order: 0 },
    ]
    expect(getTokenHighlightStyle('t1', groups)).toBe('pill')
  })

  it('returns underline for exact-only groups', () => {
    const groups = [{ key: 'exact:time', tokenIds: ['t1'], kind: 'exact' as const, order: 0 }]
    expect(getTokenHighlightStyle('t1', groups)).toBe('underline')
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
