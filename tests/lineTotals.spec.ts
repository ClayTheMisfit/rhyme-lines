import { computeLineTotals } from '@/lib/editor/lineTotals'

describe('computeLineTotals', () => {
  it('preserves blank lines and returns zero totals for them', () => {
    const text = 'spin test\n\nspin test\n'
    const totals = computeLineTotals(text)
    const lines = text.replace(/\r\n/g, '\n').split('\n')

    expect(totals).toHaveLength(lines.length)
    expect(totals[1]).toBe(0)
    expect(totals[2]).toBe(2)
  })
})
