import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { useResizeObservedGeometryInvalidation } from '@/hooks/useResizeObservedGeometryInvalidation'

type ResizeObserverCallback = ConstructorParameters<typeof ResizeObserver>[0]

class MockResizeObserver {
  static instances: MockResizeObserver[] = []
  callback: ResizeObserverCallback
  observe = jest.fn()
  disconnect = jest.fn()

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    MockResizeObserver.instances.push(this)
  }
}

function Harness({ onInvalidate }: { onInvalidate: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useResizeObservedGeometryInvalidation({ targetRef: ref, onInvalidate })
  return <div ref={ref} data-testid="surface" />
}

const notify = (observer: MockResizeObserver, width: number, height: number) => {
  observer.callback([
    {
      contentRect: { width, height } as DOMRectReadOnly,
    } as ResizeObserverEntry,
  ], observer as unknown as ResizeObserver)
}

describe('useResizeObservedGeometryInvalidation', () => {
  let originalResizeObserver: typeof ResizeObserver | undefined
  let requestAnimationFrameSpy: jest.SpyInstance<number, [FrameRequestCallback]>
  let cancelAnimationFrameSpy: jest.SpyInstance<void, [number]>
  let rafCallbacks: Map<number, FrameRequestCallback>
  let nextFrameId: number

  beforeEach(() => {
    originalResizeObserver = globalThis.ResizeObserver
    MockResizeObserver.instances = []
    rafCallbacks = new Map()
    nextFrameId = 1
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
    window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
    requestAnimationFrameSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = nextFrameId++
      rafCallbacks.set(id, callback)
      return id
    })
    cancelAnimationFrameSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks.delete(id)
    })
  })

  afterEach(() => {
    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver
      window.ResizeObserver = originalResizeObserver
    } else {
      delete (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver
      delete (window as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver
    }
    requestAnimationFrameSpy.mockRestore()
    cancelAnimationFrameSpy.mockRestore()
  })

  const flushFrame = (id = 1) => {
    const callback = rafCallbacks.get(id)
    if (!callback) return
    rafCallbacks.delete(id)
    act(() => callback(performance.now()))
  }

  it('observes the surface, coalesces changed sizes, skips unchanged sizes, and disconnects', () => {
    const onInvalidate = jest.fn()
    const { unmount, getByTestId } = render(<Harness onInvalidate={onInvalidate} />)
    const surface = getByTestId('surface')
    const observer = MockResizeObserver.instances[0]

    expect(observer.observe).toHaveBeenCalledWith(surface)

    act(() => {
      notify(observer, 640, 480)
      notify(observer, 620, 480)
      notify(observer, 620, 480)
    })

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)
    expect(onInvalidate).not.toHaveBeenCalled()

    flushFrame()
    expect(onInvalidate).toHaveBeenCalledTimes(1)

    act(() => notify(observer, 620, 480))
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)

    act(() => notify(observer, 620, 500))
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(2)
    unmount()

    expect(observer.disconnect).toHaveBeenCalledTimes(1)
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(2)
    expect(onInvalidate).toHaveBeenCalledTimes(1)
  })

  it('does not crash when ResizeObserver is unavailable', () => {
    delete (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver
    delete (window as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver

    const onInvalidate = jest.fn()
    const { unmount } = render(<Harness onInvalidate={onInvalidate} />)

    expect(() => unmount()).not.toThrow()
    expect(onInvalidate).not.toHaveBeenCalled()
  })
})
