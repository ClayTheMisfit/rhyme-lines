import { computeVisibleLineRange } from '@/editor'

describe('computeVisibleLineRange', () => {
  test('handles boundaries and overscan', () => {
    expect(
      computeVisibleLineRange({ scrollTop: 0, viewportHeight: 100, estimatedLineHeight: 20, lineCount: 50, overscan: 2 })
    ).toEqual({ startLine: 0, endLine: 7 })
  })

  test('handles very small viewport', () => {
    expect(
      computeVisibleLineRange({ scrollTop: 200, viewportHeight: 1, estimatedLineHeight: 20, lineCount: 50, overscan: 1 })
    ).toEqual({ startLine: 9, endLine: 12 })
  })

  test('clamps to line count', () => {
    expect(
      computeVisibleLineRange({ scrollTop: 1000, viewportHeight: 600, estimatedLineHeight: 20, lineCount: 30, overscan: 8 })
    ).toEqual({ startLine: 29, endLine: 29 })
  })
})
