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
      getStatus: () => null,
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
      }),
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(result.current.meta.source).toBe('local')
    expect(result.current.results.caret).toEqual(['time'])
    expect(mockedFetchAggregatedRhymes).not.toHaveBeenCalled()
  })

  it('refetches the same request after suggestions are disabled and re-enabled', async () => {
    mockedInitRhymeClient.mockResolvedValue(undefined)
    const getRhymes = jest.fn().mockResolvedValue({ results: { caret: ['time'], lineLast: ['rhyme'] }, debug: {} })
    mockedGetRhymeClient.mockReturnValue({
      getRhymes,
      getWarning: () => null,
      getStatus: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })

    const modes: Array<'perfect'> = ['perfect']
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useRhymeSuggestions({
          text: 'time',
          caretIndex: 4,
          currentLineText: 'time',
          modes,
          enabled,
        }),
      { initialProps: { enabled: true } },
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(getRhymes).toHaveBeenCalledTimes(1)
    expect(result.current.results.caret).toEqual(['time'])

    await act(async () => {
      rerender({ enabled: false })
      await flushPromises()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.results).toEqual({})

    await act(async () => {
      rerender({ enabled: true })
      await flushPromises()
    })
    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(getRhymes).toHaveBeenCalledTimes(2)
    expect(result.current.results.caret).toEqual(['time'])
  })

  it('forces spelling variants off in worker requests', async () => {
    mockedInitRhymeClient.mockResolvedValue(undefined)
    const getRhymes = jest.fn().mockResolvedValue({ results: { caret: ['time'], lineLast: [] }, debug: {} })
    mockedGetRhymeClient.mockReturnValue({
      getRhymes,
      getWarning: () => null,
      getStatus: () => null,
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
      }),
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
      getStatus: () => null,
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
      }),
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
      getStatus: () => null,
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
      }),
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
      getStatus: () => null,
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
      }),
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
      getStatus: () => null,
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
      }),
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(result.current.results.caret).toEqual(['crime', 'sublime'])
    expect(result.current.results.lineLast).toEqual(['time'])
  })
})

describe('useRhymeSuggestions synchronization and stale-response safety', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    retryLocalInit()
    mockedFetchAggregatedRhymes.mockReset()
    mockedGetRhymeClient.mockReset()
    mockedInitRhymeClient.mockReset()
    mockedInitRhymeClient.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const createDeferred = <T,>() => {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  const workerRhymes: Record<string, string> = {
    lost: 'cost',
    tonight: 'flight',
  }

  const makeWorkerResult = (token: string) => ({
    results: { caret: [workerRhymes[token] ?? 'time'], lineLast: [workerRhymes[token] ?? 'rhyme'] },
    debug: {
      caret: {
        normalizedToken: token,
        wordId: 1,
        perfectKey: token,
        vowelKey: token,
        codaKey: token,
        candidatePools: { perfect: 1, near: 0 },
      },
      lineLast: {
        normalizedToken: token,
        wordId: 1,
        perfectKey: token,
        vowelKey: token,
        codaKey: token,
        candidatePools: { perfect: 1, near: 0 },
      },
    },
  })

  it('updates the active caret target immediately during rapid typing before the debounced fetch runs', () => {
    mockedGetRhymeClient.mockReturnValue({
      getRhymes: jest.fn().mockResolvedValue(makeWorkerResult('tonight')),
      getWarning: () => null,
      getStatus: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })

    const { result, rerender } = renderHook(
      ({ text, caretIndex, currentLineText }) =>
        useRhymeSuggestions({
          text,
          caretIndex,
          currentLineText,
          modes: ['perfect'],
          enabled: true,
        }),
      {
        initialProps: {
          text: 'i lost hope',
          caretIndex: 'i lost hope'.length,
          currentLineText: 'i lost hope',
        },
      },
    )

    expect(result.current.activeTokens.caretToken).toBe('hope')

    rerender({
      text: 'i lost hope in myself tonight',
      caretIndex: 'i lost hope in myself tonight'.length,
      currentLineText: 'i lost hope in myself tonight',
    })

    expect(result.current.activeTokens.caretToken).toBe('tonight')
    expect(mockedGetRhymeClient().getRhymes).not.toHaveBeenCalled()
  })

  it('invalidates an in-flight local request as soon as the caret target changes, before the next debounce fires', async () => {
    const lost = createDeferred<ReturnType<typeof makeWorkerResult>>()
    const getRhymes = jest.fn((args) => {
      const token = args.targets.caret ?? args.targets.lineLast ?? 'unknown'
      if (token === 'lost') return lost.promise
      return Promise.resolve(makeWorkerResult(token))
    })
    mockedGetRhymeClient.mockReturnValue({
      getRhymes,
      getWarning: () => null,
      getStatus: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })

    const { result, rerender } = renderHook(
      ({ text, caretIndex, currentLineText }) =>
        useRhymeSuggestions({
          text,
          caretIndex,
          currentLineText,
          modes: ['perfect'],
          enabled: true,
        }),
      {
        initialProps: {
          text: 'lost',
          caretIndex: 4,
          currentLineText: 'lost',
        },
      },
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })
    expect(getRhymes).toHaveBeenCalledWith(expect.objectContaining({ targets: { caret: 'lost', lineLast: 'lost' } }))

    await act(async () => {
      rerender({
        text: 'lost tonight',
        caretIndex: 'lost tonight'.length,
        currentLineText: 'lost tonight',
      })
      await flushPromises()
    })
    expect(result.current.activeTokens.caretToken).toBe('tonight')

    await act(async () => {
      lost.resolve(makeWorkerResult('lost'))
      await flushPromises()
    })

    expect(result.current.activeTokens.caretToken).toBe('tonight')
    expect(result.current.results.caret ?? []).not.toContain('cost')
    expect(result.current.results.caret).toBeUndefined()
  })

  it('commits only the latest request when local worker responses resolve out of order', async () => {
    const lost = createDeferred<ReturnType<typeof makeWorkerResult>>()
    const tonight = createDeferred<ReturnType<typeof makeWorkerResult>>()
    const getRhymes = jest.fn((args) => {
      const token = args.targets.caret ?? args.targets.lineLast ?? 'unknown'
      if (token === 'lost') return lost.promise
      if (token === 'tonight') return tonight.promise
      return Promise.resolve(makeWorkerResult(token))
    })
    mockedGetRhymeClient.mockReturnValue({
      getRhymes,
      getWarning: () => null,
      getStatus: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })

    const { result, rerender } = renderHook(
      ({ text, caretIndex, currentLineText }) =>
        useRhymeSuggestions({
          text,
          caretIndex,
          currentLineText,
          modes: ['perfect'],
          enabled: true,
        }),
      {
        initialProps: { text: 'lost', caretIndex: 4, currentLineText: 'lost' },
      },
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    await act(async () => {
      rerender({
        text: 'lost tonight',
        caretIndex: 'lost tonight'.length,
        currentLineText: 'lost tonight',
      })
    })

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    await act(async () => {
      tonight.resolve(makeWorkerResult('tonight'))
      await flushPromises()
    })
    expect(result.current.results.caret).toEqual(['flight'])

    await act(async () => {
      lost.resolve(makeWorkerResult('lost'))
      await flushPromises()
    })

    expect(result.current.activeTokens.caretToken).toBe('tonight')
    expect(result.current.results.caret).toEqual(['flight'])
    expect(result.current.debug.caretDetails?.normalizedToken).toBe('tonight')
  })

  it('aborts an in-flight online request when a newer caret target appears', async () => {
    mockedInitRhymeClient.mockRejectedValue(new Error('local unavailable'))
    mockedGetRhymeClient.mockReturnValue({
      getRhymes: jest.fn().mockResolvedValue(makeWorkerResult('lost')),
      getWarning: () => null,
      getStatus: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })
    const signals: AbortSignal[] = []
    mockedFetchAggregatedRhymes.mockImplementation((_token, options) => {
      if (options?.signal) signals.push(options.signal)
      return new Promise<AggregationResult>(() => {})
    })

    const { rerender } = renderHook(
      ({ text, caretIndex, currentLineText }) =>
        useRhymeSuggestions({
          text,
          caretIndex,
          currentLineText,
          modes: ['perfect'],
          enabled: true,
        }),
      {
        initialProps: { text: 'lost', caretIndex: 4, currentLineText: 'lost' },
      },
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(signals).toHaveLength(1)
    expect(signals[0].aborted).toBe(false)

    await act(async () => {
      rerender({
        text: 'lost tonight',
        caretIndex: 'lost tonight'.length,
        currentLineText: 'lost tonight',
      })
      await flushPromises()
    })

    expect(signals[0].aborted).toBe(true)
  })
})
