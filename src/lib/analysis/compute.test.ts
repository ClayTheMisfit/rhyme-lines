import { computeAnalysis, getRhymeRuntimeCacheKey } from './compute'

const buildHighlightGroupsMock = jest.fn(() => ({ groups: [] }))

jest.mock('@/lib/rhyme/highlight', () => {
  const actual = jest.requireActual('@/lib/rhyme/highlight')
  return {
    ...actual,
    buildHighlightGroups: (...args: unknown[]) => buildHighlightGroupsMock(...args),
  }
})

describe('computeAnalysis rhyme key caching', () => {
  beforeEach(() => {
    buildHighlightGroupsMock.mockClear()
  })

  test('uses runtime-scoped cache keys', () => {
    expect(getRhymeRuntimeCacheKey(null)).toBe('none')
    expect(getRhymeRuntimeCacheKey({} as never)).toBe('cmu:v1')
  })

  test('does not reuse no-runtime cache map after runtime becomes available', () => {
    const lines = [{ id: 'line-1', text: 'rose close' }]

    computeAnalysis(lines, {
      docId: 'doc-1',
      seq: 1,
      rhymeHighlights: { enabled: true },
      rhymeRuntime: null,
    })

    computeAnalysis(lines, {
      docId: 'doc-1',
      seq: 2,
      rhymeHighlights: { enabled: true },
      rhymeRuntime: {} as never,
    })

    const firstCallOptions = buildHighlightGroupsMock.mock.calls[0]?.[1] as { cache: Map<string, unknown> }
    const secondCallOptions = buildHighlightGroupsMock.mock.calls[1]?.[1] as { cache: Map<string, unknown> }

    expect(firstCallOptions.cache).toBeInstanceOf(Map)
    expect(secondCallOptions.cache).toBeInstanceOf(Map)
    expect(secondCallOptions.cache).not.toBe(firstCallOptions.cache)
  })
})
