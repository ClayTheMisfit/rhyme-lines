import { act, renderHook } from '@testing-library/react'
import { useRhymeSuggestions } from '@/lib/rhyme-db/useRhymeSuggestions'
import { getPreferredRhymeSource, retryLocalInit } from '@/lib/rhymes/rhymeSource'
import type { AggregationResult } from '@/lib/rhyme/aggregate'
import type { RhymeWorkerError } from '@/lib/rhyme-db/rhymeWorkerClient'
import { fetchAggregatedRhymesWithProviders } from '@/lib/rhyme/aggregate'
import { getRhymeClient, initRhymeClient } from '@/lib/rhyme-db/rhymeClientSingleton'

jest.mock('@/lib/rhyme/aggregate', () => ({
  fetchAggregatedRhymesWithProviders: jest.fn(),
}))

jest.mock('@/lib/rhyme-db/rhymeClientSingleton', () => ({
  getRhymeClient: jest.fn(),
  initRhymeClient: jest.fn(),
}))

const mockedFetchAggregatedRhymes = fetchAggregatedRhymesWithProviders as jest.MockedFunction<
  typeof fetchAggregatedRhymesWithProviders
>
const mockedGetRhymeClient = getRhymeClient as jest.MockedFunction<typeof getRhymeClient>
const mockedInitRhymeClient = initRhymeClient as jest.MockedFunction<typeof initRhymeClient>

const flushPromises = () => Promise.resolve()

const makeAggregationResult = (words: string[], providerOk = true): AggregationResult => {
  const suggestions = words.map((word) => ({
    word,
    normalized: word,
    quality: 'perfect' as const,
    score: 10,
    sources: ['datamuse'],
    providers: ['datamuse'],
  }))
  return {
    suggestions,
    buckets: {
      perfect: suggestions,
      near: [],
      slant: [],
    },
    providerStates: [
      {
        name: 'datamuse',
        ok: providerOk,
        durationMs: 10,
        skipped: false,
      },
    ],
  }
}

describe('useRhymeSuggestions fallback', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    retryLocalInit()
    mockedFetchAggregatedRhymes.mockReset()
    mockedGetRhymeClient.mockReset()
    mockedInitRhymeClient.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('uses local worker when available', async () => {
    mockedInitRhymeClient.mockResolvedValue(undefined)
    mockedGetRhymeClient.mockReturnValue({
      getRhymes: async () => ({ results: { caret: ['time'], lineLast: ['rhyme'] }, debug: {} }),
      getWarning: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })

    const { result } = renderHook(() =>
      useRhymeSuggestions({
        text: 'time',
        caretIndex: 4,
        currentLineText: 'time',
        modes: ['perfect'],
        enabled: true,
      })
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(result.current.meta.source).toBe('local')
    expect(result.current.results.caret).toEqual(['time'])
    expect(mockedFetchAggregatedRhymes).not.toHaveBeenCalled()
  })

  it('forces spelling variants off in worker requests', async () => {
    mockedInitRhymeClient.mockResolvedValue(undefined)
    const getRhymes = jest.fn().mockResolvedValue({ results: { caret: ['time'], lineLast: [] }, debug: {} })
    mockedGetRhymeClient.mockReturnValue({
      getRhymes,
      getWarning: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })

    renderHook(() =>
      useRhymeSuggestions({
        text: 'time',
        caretIndex: 4,
        currentLineText: 'time',
        modes: ['perfect'],
        showVariants: true,
        enabled: true,
      })
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(getRhymes).toHaveBeenCalled()
    const call = getRhymes.mock.calls[0]?.[0]
    expect(call?.context?.showVariants).toBe(false)
  })

  it('falls back to online when init fails', async () => {
    mockedInitRhymeClient.mockRejectedValue(new Error('init failed'))
    mockedGetRhymeClient.mockReturnValue({
      getRhymes: async () => ({ results: { caret: [], lineLast: [] }, debug: {} }),
      getWarning: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })
    mockedFetchAggregatedRhymes.mockResolvedValue(makeAggregationResult(['time']))

    const { result } = renderHook(() =>
      useRhymeSuggestions({
        text: 'time',
        caretIndex: 4,
        currentLineText: 'time',
        modes: ['perfect'],
        enabled: true,
      })
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(result.current.meta.source).toBe('online')
    expect(result.current.results.caret).toEqual(['time'])
    expect(getPreferredRhymeSource()).toBe('online')
  })

  it('falls back to online when worker reports DB unavailable', async () => {
    mockedInitRhymeClient.mockResolvedValue(undefined)
    const dbError = new Error('db missing') as RhymeWorkerError
    dbError.code = 'DB_UNAVAILABLE'
    mockedGetRhymeClient.mockReturnValue({
      getRhymes: async () => {
        throw dbError
      },
      getWarning: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })
    mockedFetchAggregatedRhymes.mockResolvedValue(makeAggregationResult(['time']))

    const { result } = renderHook(() =>
      useRhymeSuggestions({
        text: 'time',
        caretIndex: 4,
        currentLineText: 'time',
        modes: ['perfect'],
        enabled: true,
      })
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(result.current.meta.source).toBe('online')
    expect(getPreferredRhymeSource()).toBe('online')
  })

  it('returns an error when both local and online fail', async () => {
    mockedInitRhymeClient.mockRejectedValue(new Error('init failed'))
    mockedGetRhymeClient.mockReturnValue({
      getRhymes: async () => ({ results: { caret: [], lineLast: [] }, debug: {} }),
      getWarning: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })
    mockedFetchAggregatedRhymes.mockResolvedValue(makeAggregationResult([], false))

    const { result } = renderHook(() =>
      useRhymeSuggestions({
        text: 'time',
        caretIndex: 4,
        currentLineText: 'time',
        modes: ['perfect'],
        enabled: true,
      })
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Failed to fetch rhymes from online providers.')
  })
})

describe('useRhymeSuggestions english filtering', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    retryLocalInit()
    mockedFetchAggregatedRhymes.mockReset()
    mockedGetRhymeClient.mockReset()
    mockedInitRhymeClient.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('filters non-English words and preserves order per target bucket', async () => {
    mockedInitRhymeClient.mockResolvedValue(undefined)
    mockedGetRhymeClient.mockReturnValue({
      getRhymes: async () => ({
        results: {
          caret: ['crime', 'hochzeit', 'sublime'],
          lineLast: ['hochzeit', 'time'],
        },
        debug: {},
      }),
      getWarning: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })

    const { result } = renderHook(() =>
      useRhymeSuggestions({
        text: 'time',
        caretIndex: 4,
        currentLineText: 'time',
        modes: ['perfect'],
        enabled: true,
      })
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(result.current.results.caret).toEqual(['crime', 'sublime'])
    expect(result.current.results.lineLast).toEqual(['time'])
  })
})
