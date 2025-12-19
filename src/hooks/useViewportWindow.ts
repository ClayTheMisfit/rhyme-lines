import { useEffect, useMemo, useState } from 'react'

type Options = {
  bufferLines?: number
}

type WindowState = {
  activeLineIds: Set<string>
  range: { start: number; end: number }
}

const EMPTY_SET: Set<string> = new Set()
const DEFAULT_RANGE = { start: 0, end: Number.POSITIVE_INFINITY }

export function useViewportWindow(
  containerRef: React.RefObject<HTMLElement | null>,
  lineElementsRef: React.RefObject<HTMLDivElement[]>,
  lineVersion: number,
  options: Options = {}
) {
  const bufferLines = options.bufferLines ?? 10
  const [state, setState] = useState<WindowState>({ activeLineIds: EMPTY_SET, range: DEFAULT_RANGE })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const container = containerRef.current
    const lineElements = lineElementsRef.current
    if (!container || !lineElements || lineElements.length === 0) {
      setState({ activeLineIds: EMPTY_SET, range: DEFAULT_RANGE })
      return
    }

    const visible = new Set<number>()

    const commit = () => {
      if (!visible.size) {
        setState({ activeLineIds: EMPTY_SET, range: DEFAULT_RANGE })
        return
      }
      const sorted = Array.from(visible).sort((a, b) => a - b)
      const startIndex = Math.max(0, sorted[0] - bufferLines)
      const endIndex = sorted[sorted.length - 1] + bufferLines
      const activeLineIds = new Set<string>()
      for (const line of lineElements) {
        const index = Number.parseInt(line.dataset.lineIndex ?? '-1', 10)
        if (Number.isNaN(index)) continue
        if (index >= startIndex && index <= endIndex && line.dataset.lineId) {
          activeLineIds.add(line.dataset.lineId)
        }
      }
      setState({
        activeLineIds,
        range: { start: startIndex, end: endIndex },
      })
    }

    const handleGeometryMeasure = () => {
      const containerRect = container.getBoundingClientRect()
      let changed = false
      for (const line of lineElements) {
        const rect = line.getBoundingClientRect()
        const index = Number.parseInt(line.dataset.lineIndex ?? '-1', 10)
        if (Number.isNaN(index)) continue
        const intersects = rect.bottom >= containerRect.top && rect.top <= containerRect.bottom
        if (intersects) {
          if (!visible.has(index)) {
            visible.add(index)
            changed = true
          }
        } else if (visible.delete(index)) {
          changed = true
        }
      }
      if (changed) {
        commit()
      }
    }

    let observer: IntersectionObserver | null = null
    let resizeCleanup: (() => void) | null = null

    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          let changed = false
          for (const entry of entries) {
            const line = entry.target as HTMLElement
            const index = Number.parseInt(line.dataset.lineIndex ?? '-1', 10)
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
            commit()
          }
        },
        { root: container, threshold: 0 }
      )
      lineElements.forEach((line) => observer?.observe(line))
    } else {
      const onScroll = () => handleGeometryMeasure()
      const onResize = () => handleGeometryMeasure()
      container.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onResize)
      resizeCleanup = () => {
        container.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', onResize)
      }
      handleGeometryMeasure()
    }

    const rafId = window.requestAnimationFrame(() => {
      handleGeometryMeasure()
    })

    return () => {
      if (observer) observer.disconnect()
      if (resizeCleanup) resizeCleanup()
      window.cancelAnimationFrame(rafId)
    }
  }, [bufferLines, containerRef, lineElementsRef, lineVersion])

  return useMemo(
    () => ({
      activeLineIds: state.activeLineIds,
      viewportRange: state.range,
    }),
    [state.activeLineIds, state.range]
  )
}
