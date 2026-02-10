import { renderHook, act } from '@testing-library/react'
import { useAutosave } from '@/hooks/useAutosave'
import { useAutosaveStore } from '@/store/autosaveStore'

describe('useAutosave', () => {
  beforeEach(() => {
    useAutosaveStore.setState({
      status: 'idle',
      lastSavedAt: null,
      errorMessage: null,
      runSave: null,
    })
  })

  it('transitions to error on timeout', async () => {
    jest.useFakeTimers()
    global.fetch = jest.fn((_url, options) => {
      return new Promise((_resolve, reject) => {
        const signal = options?.signal as AbortSignal | undefined
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      }) as Promise<Response>
    })

    const { result } = renderHook(() =>
      useAutosave({
        getPayload: () => ({ text: 'hello' }),
        debounceMs: 10,
      })
    )

    act(() => {
      result.current.markDirty()
    })

    act(() => {
      jest.advanceTimersByTime(11)
    })

    act(() => {
      jest.advanceTimersByTime(10_000)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(useAutosaveStore.getState().status).toBe('error')

    jest.useRealTimers()
  })

  it('ignores stale completions', async () => {
    jest.useFakeTimers()
    let resolveFirst: (() => void) | null = null

    global.fetch = jest
      .fn()
      .mockImplementationOnce(() =>
        new Promise<Response>((resolve) => {
          resolveFirst = () => resolve({ ok: true, status: 200 } as Response)
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200 } as Response))

    const { result } = renderHook(() =>
      useAutosave({
        getPayload: () => ({ text: 'hello' }),
        debounceMs: 10,
      })
    )

    act(() => {
      result.current.markDirty()
    })

    act(() => {
      jest.advanceTimersByTime(11)
    })

    act(() => {
      result.current.markDirty()
    })

    act(() => {
      jest.advanceTimersByTime(11)
    })

    await act(async () => {
      await Promise.resolve()
    })

    resolveFirst?.()

    expect(useAutosaveStore.getState().status).toBe('saved')

    jest.useRealTimers()
  })
})
