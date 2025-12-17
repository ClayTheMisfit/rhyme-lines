import { computeLineTotals, splitNormalizedLines } from '@/lib/editor/lineTotals'

describe('computeLineTotals', () => {
  it('preserves blank lines and returns zero totals for them', () => {
    const text = 'spin test\n\nspin test\n'
    const totals = computeLineTotals(text)
    const lines = splitNormalizedLines(text)

    expect(lines).toHaveLength(4)
    expect(totals).toHaveLength(lines.length)
    expect(totals[1]).toBe(0)
    expect(totals[2]).toBe(2)
  })
})
