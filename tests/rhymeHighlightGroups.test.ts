import { buildHighlightGroups } from '@/lib/rhyme/highlightGroups'

describe('rhyme highlight grouping', () => {
  it('builds perfect rhyme groups for repeated rhyme keys', () => {
    const tokens = [
      { lineId: 'l1', tokenIndex: 0, norm: 'cold', text: 'cold' },
      { lineId: 'l1', tokenIndex: 1, norm: 'old', text: 'old' },
      { lineId: 'l1', tokenIndex: 2, norm: 'told', text: 'told' },
      { lineId: 'l1', tokenIndex: 3, norm: 'fold', text: 'fold' },
    ]
    const rhymeKeysByNorm = new Map([
      ['cold', 'OWLD'],
      ['old', 'OWLD'],
      ['told', 'OWLD'],
      ['fold', 'OWLD'],
    ])

    const result = buildHighlightGroups({
      tokens,
      includeExactRepeats: false,
      ignoreStopwords: false,
      rhymeKeysByNorm,
    })

    const group = result.groups.find((item) => item.kind === 'perfect')
    expect(group).toBeTruthy()
    expect(group?.key).toBe('perfect:OWLD')
    expect(group?.freq).toBe(4)
  })

  it('respects the exact repeat toggle', () => {
    const tokens = [
      { lineId: 'l1', tokenIndex: 0, norm: 'qwerk', text: 'qwerk' },
      { lineId: 'l1', tokenIndex: 1, norm: 'qwerk', text: 'qwerk' },
    ]
    const rhymeKeysByNorm = new Map<string, string | null>()

    const disabled = buildHighlightGroups({
      tokens,
      includeExactRepeats: false,
      ignoreStopwords: false,
      rhymeKeysByNorm,
    })
    expect(disabled.groups.some((group) => group.kind === 'exact')).toBe(false)

    const enabled = buildHighlightGroups({
      tokens,
      includeExactRepeats: true,
      ignoreStopwords: false,
      rhymeKeysByNorm,
    })
    expect(enabled.groups.some((group) => group.kind === 'exact')).toBe(true)
  })
})
