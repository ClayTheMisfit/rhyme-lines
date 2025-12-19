import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

type WindowRange = { start: number; end: number }

type Options = {
  containerRef: React.RefObject<HTMLElement>
  lineElementsRef: React.MutableRefObject<HTMLDivElement[]>
  buffer?: number
  version?: number
}

const DEFAULT_BUFFER = 8

const clampRange = (start: number, end: number, maxIndex: number): WindowRange => {
  const clampedStart = Math.max(0, start)
  const clampedEnd = Math.min(maxIndex, end)
  if (!Number.isFinite(clampedStart) || !Number.isFinite(clampedEnd)) {
    return { start: 0, end: -1 }
  }
  return { start: clampedStart, end: clampedEnd }
}

export function useViewportWindow({
  containerRef,
  lineElementsRef,
  buffer = DEFAULT_BUFFER,
  version = 0,
}: Options) {
  const [activeLineIds, setActiveLineIds] = useState<Set<string>>(new Set())
  const [activeRange, setActiveRange] = useState<WindowRange>({ start: 0, end: -1 })
  const lastRangeRef = useRef<WindowRange>({ start: 0, end: -1 })

  useEffect(() => {
    const container = containerRef.current
    const lines = lineElementsRef.current
    if (!container || !lines.length) {
      setActiveLineIds(new Set())
      setActiveRange({ start: 0, end: -1 })
      lastRangeRef.current = { start: 0, end: -1 }
      return
    }

    const visible = new Set<number>()
    const recomputeWindow = () => {
      if (!visible.size) {
        setActiveLineIds(new Set())
        setActiveRange({ start: 0, end: -1 })
        lastRangeRef.current = { start: 0, end: -1 }
        return
      }
      const sorted = Array.from(visible).sort((a, b) => a - b)
      const startVisible = sorted[0]
      const endVisible = sorted[sorted.length - 1]
      const rangeWithBuffer = clampRange(
        startVisible - buffer,
        endVisible + buffer,
        lineElementsRef.current.length - 1
      )

      const nextRange = {
        start: rangeWithBuffer.start,
        end: rangeWithBuffer.end,
      }

      if (nextRange.start === lastRangeRef.current.start && nextRange.end === lastRangeRef.current.end) {
        return
      }

      const nextActive = new Set<string>()
      for (let index = nextRange.start; index <= nextRange.end; index += 1) {
        const element = lineElementsRef.current[index]
        const id = element?.dataset.lineId
        if (id) {
          nextActive.add(id)
        }
      }

      setActiveLineIds(nextActive)
      setActiveRange(nextRange)
      lastRangeRef.current = nextRange
    }

    const handleManualMeasure = () => {
      const containerRect = container.getBoundingClientRect()
      const seen = new Set<number>()
      lines.forEach((line) => {
        const rect = line.getBoundingClientRect()
        const index = Number.parseInt(line.dataset.lineIndex ?? '-1', 10)
        if (Number.isNaN(index)) return
        const intersects = rect.bottom >= containerRect.top && rect.top <= containerRect.bottom
        if (intersects) {
          seen.add(index)
          visible.add(index)
        } else {
          visible.delete(index)
        }
      })
      if (!seen.size) {
        visible.clear()
      }
      recomputeWindow()
    }

    let cleanup: (() => void) | undefined
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          let changed = false
          for (const entry of entries) {
            const element = entry.target as HTMLElement
            const index = Number.parseInt(element.dataset.lineIndex ?? '-1', 10)
            if (Number.isNaN(index)) continue
            if (entry.isIntersecting && entry.intersectionRatio > 0) {
              if (!visible.has(index)) {
                visible.add(index)
                changed = true
              }
            } else if (visible.delete(index)) {
              changed = true
            }
          }
          if (changed) {
            recomputeWindow()
          }
        },
        { root: container, threshold: 0 }
      )

      lines.forEach((line) => observer.observe(line))
      cleanup = () => observer.disconnect()
      recomputeWindow()
    } else {
      const onScroll = () => handleManualMeasure()
      const onResize = () => handleManualMeasure()
      container.addEventListener('scroll', onScroll, { passive: true })
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', onResize, { passive: true })
      }
      cleanup = () => {
        container.removeEventListener('scroll', onScroll)
        if (typeof window !== 'undefined') {
          window.removeEventListener('resize', onResize)
        }
      }
      handleManualMeasure()
    }

    return () => {
      cleanup?.()
    }
  }, [buffer, containerRef, lineElementsRef, version])

  return useMemo(
    () => ({
      activeLineIds,
      activeRange,
    }),
    [activeLineIds, activeRange]
  )
}
