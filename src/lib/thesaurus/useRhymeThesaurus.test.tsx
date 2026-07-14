import { renderHook, waitFor } from '@testing-library/react'
import { clearRhymeThesaurusCache, getRhymeThesaurusCacheSize, useRhymeThesaurus } from '@/lib/thesaurus/useRhymeThesaurus'
import { fetchDatamuseThesaurus } from '@/lib/thesaurus/providers/datamuseThesaurus'

jest.mock('@/lib/thesaurus/providers/datamuseThesaurus')
const mockedFetch = fetchDatamuseThesaurus as jest.MockedFunction<typeof fetchDatamuseThesaurus>

const resultFor = (target: string) => ({ target, concepts: [], synonyms: [], related: [] })

describe('useRhymeThesaurus', () => {
  beforeEach(() => {
    clearRhymeThesaurusCache()
    mockedFetch.mockReset()
  })

  it('does not request while disabled or invalid', () => {
    renderHook(() => useRhymeThesaurus({ target: 'dream', enabled: false }))
    renderHook(() => useRhymeThesaurus({ target: '!!!', enabled: true }))
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('fetches once when enabled and caches success', async () => {
    mockedFetch.mockResolvedValue(resultFor('dream'))
    const first = renderHook(() => useRhymeThesaurus({ target: 'dream', enabled: true }))
    await waitFor(() => expect(first.result.current.status).toBe('success'))
    expect(mockedFetch).toHaveBeenCalledTimes(1)

    renderHook(() => useRhymeThesaurus({ target: ' dream ', enabled: true }))
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })

  it('aborts stale requests and prevents stale overwrite', async () => {
    const resolvers: Array<(value: ReturnType<typeof resultFor>) => void> = []
    mockedFetch.mockImplementation((target) => new Promise((resolve) => resolvers.push(() => resolve(resultFor(target)))))
    const { result, rerender } = renderHook(({ target }) => useRhymeThesaurus({ target, enabled: true }), { initialProps: { target: 'dream' } })
    rerender({ target: 'night' })
    resolvers[0](resultFor('dream'))
    resolvers[1](resultFor('night'))
    await waitFor(() => expect(result.current.result?.target).toBe('night'))
    expect(mockedFetch.mock.calls[0][1]?.aborted).toBe(true)
  })

  it('keeps errors isolated and bounds cache', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useRhymeThesaurus({ target: 'dream', enabled: true }))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('offline')
    expect(getRhymeThesaurusCacheSize()).toBe(0)
  })
})
