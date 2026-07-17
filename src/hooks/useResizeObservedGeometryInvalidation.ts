import { useEffect, useRef } from 'react'

type Size = {
  width: number
  height: number
}

type UseResizeObservedGeometryInvalidationArgs<T extends Element> = {
  targetRef: React.RefObject<T | null>
  onInvalidate: () => void
}

export function useResizeObservedGeometryInvalidation<T extends Element>({
  targetRef,
  onInvalidate,
}: UseResizeObservedGeometryInvalidationArgs<T>) {
  const lastSizeRef = useRef<Size | null>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const target = targetRef.current
    if (!target || typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
      return
    }

    const invalidateOnNextFrame = () => {
      if (frameRef.current !== null) {
        return
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null
        onInvalidate()
      })
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      const nextSize = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }
      const previousSize = lastSizeRef.current

      if (previousSize && previousSize.width === nextSize.width && previousSize.height === nextSize.height) {
        return
      }

      lastSizeRef.current = nextSize
      invalidateOnNextFrame()
    })

    observer.observe(target)

    return () => {
      observer.disconnect()

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [onInvalidate, targetRef])
}
