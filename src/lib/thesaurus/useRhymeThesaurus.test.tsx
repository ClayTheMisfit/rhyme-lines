import { act, renderHook, waitFor } from '@testing-library/react'
import { clearRhymeThesaurusCache, getRhymeThesaurusCacheSize, useRhymeThesaurus } from '@/lib/thesaurus/useRhymeThesaurus'
import { fetchDatamuseThesaurus } from '@/lib/thesaurus/providers/datamuseThesaurus'

jest.mock('@/lib/thesaurus/providers/datamuseThesaurus')
const mockedFetch = fetchDatamuseThesaurus as jest.MockedFunction<typeof fetchDatamuseThesaurus>

const resultFor = (target: string) => ({ target, concepts: [], synonyms: [], related: [] })
const flushDebounce = () => act(() => jest.advanceTimersByTime(250))

describe('useRhymeThesaurus', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    clearRhymeThesaurusCache()
    mockedFetch.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('does not request while disabled or invalid', () => {
    renderHook(() => useRhymeThesaurus({ target: 'dream', enabled: false }))
    renderHook(() => useRhymeThesaurus({ target: '!!!', enabled: true }))
    flushDebounce()
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('clears previous result when disabled or invalid', async () => {
    mockedFetch.mockResolvedValue(resultFor('dream'))
    const { result, rerender } = renderHook(({ target, enabled }) => useRhymeThesaurus({ target, enabled }), {
      initialProps: { target: 'dream', enabled: true },
    })
    flushDebounce()
    await waitFor(() => expect(result.current.status).toBe('success'))

    rerender({ target: '!!!', enabled: true })
    expect(result.current).toMatchObject({ status: 'idle', phase: 'idle', result: null, error: undefined })

    rerender({ target: 'dream', enabled: false })
    expect(result.current).toMatchObject({ status: 'idle', phase: 'idle', result: null, error: undefined })
  })

  it('fetches once when enabled and caches success', async () => {
    mockedFetch.mockResolvedValue(resultFor('dream'))
    const first = renderHook(() => useRhymeThesaurus({ target: 'dream', enabled: true }))
    flushDebounce()
    await waitFor(() => expect(first.result.current.status).toBe('success'))
    expect(mockedFetch).toHaveBeenCalledTimes(1)

    const second = renderHook(() => useRhymeThesaurus({ target: ' dream ', enabled: true }))
    flushDebounce()
    await waitFor(() => expect(second.result.current.status).toBe('success'))
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })

  it('aborts stale requests and prevents stale overwrite', async () => {
    const resolvers: Array<() => void> = []
    mockedFetch.mockImplementation((target) => new Promise((resolve) => resolvers.push(() => resolve(resultFor(target)))))
    const { result, rerender } = renderHook(({ target }) => useRhymeThesaurus({ target, enabled: true }), { initialProps: { target: 'dream' } })
    flushDebounce()
    rerender({ target: 'night' })
    flushDebounce()
    await act(async () => {
      resolvers[0]()
      resolvers[1]()
    })
    await waitFor(() => expect(result.current.result?.target).toBe('night'))
    expect(mockedFetch.mock.calls[0][1]?.aborted).toBe(true)
  })

  it('does not preserve old-target results during a new-target load', async () => {
    mockedFetch.mockResolvedValueOnce(resultFor('dream')).mockResolvedValueOnce(resultFor('night'))
    const { result, rerender } = renderHook(({ target }) => useRhymeThesaurus({ target, enabled: true }), { initialProps: { target: 'dream' } })
    flushDebounce()
    await waitFor(() => expect(result.current.result?.target).toBe('dream'))
    rerender({ target: 'night' })
    expect(result.current).toMatchObject({ status: 'loading', phase: 'initial', result: null })
  })

  it('preserves same-target results during explicit refresh', async () => {
    mockedFetch.mockResolvedValueOnce(resultFor('dream')).mockResolvedValueOnce(resultFor('dream'))
    const { result } = renderHook(() => useRhymeThesaurus({ target: 'dream', enabled: true }))
    flushDebounce()
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.refresh())
    expect(result.current).toMatchObject({ status: 'loading', phase: 'refreshing', result: resultFor('dream') })
    await waitFor(() => expect(result.current.status).toBe('success'))
  })

  it('debounces rapid target changes and requests only the final target', async () => {
    mockedFetch.mockResolvedValue(resultFor('dreaming'))
    const { rerender } = renderHook(({ target }) => useRhymeThesaurus({ target, enabled: true }), { initialProps: { target: 'dream' } })
    act(() => jest.advanceTimersByTime(100))
    rerender({ target: 'dreams' })
    act(() => jest.advanceTimersByTime(100))
    rerender({ target: 'dreaming' })
    flushDebounce()
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1))
    expect(mockedFetch).toHaveBeenCalledWith('dreaming', expect.any(AbortSignal))
  })

  it('keeps errors isolated and bounds cache', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useRhymeThesaurus({ target: 'dream', enabled: true }))
    flushDebounce()
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('offline')
    expect(getRhymeThesaurusCacheSize()).toBe(0)
  })
})
