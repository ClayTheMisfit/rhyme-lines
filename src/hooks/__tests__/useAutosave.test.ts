import { act, renderHook } from '@testing-library/react'
import { useAutosave } from '@/hooks/useAutosave'
import { useAutosaveStore } from '@/store/autosaveStore'

const tryWriteVersionedMock = jest.fn()

jest.mock('@/lib/persist/storage', () => ({
  tryWriteVersioned: (...args: unknown[]) => tryWriteVersionedMock(...args),
}))

describe('useAutosave revision state machine', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    tryWriteVersionedMock.mockReset().mockReturnValue({ ok: true })
    useAutosaveStore.setState({
      rev: 0,
      savedRev: 0,
      isSaving: false,
      lastError: null,
      status: 'saved',
      lastSavedAt: null,
      runSave: null,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('transitions dirty -> saving -> saved after debounce and successful write', async () => {
    const { result } = renderHook(() => useAutosave({ debounceMs: 10 }))

    act(() => {
      result.current.markTextChanged()
    })
    expect(useAutosaveStore.getState().status).toBe('dirty')

    act(() => {
      jest.advanceTimersByTime(11)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(useAutosaveStore.getState().status).toBe('saved')
    expect(useAutosaveStore.getState().savedRev).toBe(useAutosaveStore.getState().rev)
  })

  it('keeps state dirty when an in-flight save completes after a new edit', async () => {
    let resolveFirst: (() => void) | null = null
    tryWriteVersionedMock.mockImplementationOnce(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          resolveFirst = () => resolve({ ok: true })
        })
    )

    const { result } = renderHook(() => useAutosave({ debounceMs: 10 }))

    act(() => {
      result.current.markTextChanged()
      jest.advanceTimersByTime(11)
    })

    act(() => {
      result.current.markTextChanged()
    })

    await act(async () => {
      resolveFirst?.()
      await Promise.resolve()
    })

    const state = useAutosaveStore.getState()
    expect(state.status).toBe('dirty')
    expect(state.savedRev).toBeLessThan(state.rev)
  })

  it('sets error on storage failure and keeps document dirty', async () => {
    tryWriteVersionedMock.mockReturnValue({ ok: false, error: 'Quota exceeded' })

    const { result } = renderHook(() => useAutosave({ debounceMs: 10 }))

    act(() => {
      result.current.markTextChanged()
      jest.advanceTimersByTime(11)
    })

    await act(async () => {
      await Promise.resolve()
    })

    const state = useAutosaveStore.getState()
    expect(state.status).toBe('error')
    expect(state.lastError).toBe('Quota exceeded')
    expect(state.savedRev).toBeLessThan(state.rev)
  })
})
