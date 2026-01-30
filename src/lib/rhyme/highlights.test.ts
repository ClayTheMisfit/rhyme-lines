import { buildRhymeHighlightMap } from '@/lib/rhyme/highlights'

describe('buildRhymeHighlightMap', () => {
  it('prefers stronger highlight kinds when multiple matches exist', () => {
    const tokenIndex = new Map<string, string[]>([
      ['play', ['token-1']],
      ['stay', ['token-2']],
    ])

    const highlights = buildRhymeHighlightMap({
      tokenIndex,
      candidates: [
        { word: 'play', kind: 'slant' },
        { word: 'play', kind: 'near' },
        { word: 'stay', kind: 'perfect' },
      ],
      targetTokenId: null,
    })

    expect(highlights.get('token-1')).toBe('near')
    expect(highlights.get('token-2')).toBe('perfect')
  })

  it('marks the target token as target even when it is also a rhyme match', () => {
    const tokenIndex = new Map<string, string[]>([
      ['day', ['token-3', 'token-4']],
    ])

    const highlights = buildRhymeHighlightMap({
      tokenIndex,
      candidates: [{ word: 'day', kind: 'perfect' }],
      targetTokenId: 'token-3',
    })

    expect(highlights.get('token-3')).toBe('target')
    expect(highlights.get('token-4')).toBe('perfect')
  })
})
