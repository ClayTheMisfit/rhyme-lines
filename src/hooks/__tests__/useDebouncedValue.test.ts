import { renderHook, act } from '@testing-library/react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('keeps previous value until the debounce window closes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 120), {
      initialProps: { value: 'alpha' },
    })

    expect(result.current).toBe('alpha')

    rerender({ value: 'beta' })
    expect(result.current).toBe('alpha')

    act(() => {
      jest.advanceTimersByTime(119)
    })
    expect(result.current).toBe('alpha')

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe('beta')
  })

  it('coalesces rapid updates into the last value', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
      initialProps: { value: 1 },
    })

    rerender({ value: 2 })
    rerender({ value: 3 })

    act(() => {
      jest.advanceTimersByTime(100)
    })

    expect(result.current).toBe(3)
  })
})
