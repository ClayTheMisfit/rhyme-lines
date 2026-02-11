import { useEffect, useMemo, useState } from 'react'
import { computeVisibleLineRange } from './computeVisibleLineRange'

type Args = {
  containerRef: React.RefObject<HTMLElement | null>
  lineElementsRef: React.RefObject<HTMLDivElement[]>
  lineVersion: number
  overscan?: number
  estimatedLineHeight?: number
}

export function useLineVirtualization({
  containerRef,
  lineElementsRef,
  lineVersion,
  overscan = 12,
  estimatedLineHeight = 28,
}: Args) {
  const [range, setRange] = useState({ startLine: 0, endLine: Number.POSITIVE_INFINITY })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let rafId: number | null = null
    const update = () => {
      const lineCount = lineElementsRef.current.length
      const next = computeVisibleLineRange({
        scrollTop: container.scrollTop,
        viewportHeight: container.clientHeight,
        estimatedLineHeight,
        lineCount,
        overscan,
      })
      setRange(next)
    }

    const onScroll = () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      rafId = window.requestAnimationFrame(update)
    }

    update()
    container.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      container.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [containerRef, estimatedLineHeight, lineElementsRef, lineVersion, overscan])

  const activeLineIds = useMemo(() => {
    const ids = new Set<string>()
    for (const line of lineElementsRef.current) {
      const index = Number.parseInt(line.dataset.lineIndex ?? '-1', 10)
      const id = line.dataset.lineId
      if (!id || Number.isNaN(index)) continue
      if (index >= range.startLine && index <= range.endLine) ids.add(id)
    }
    return ids
  }, [lineElementsRef, range])

  return {
    viewportRange: { start: range.startLine, end: range.endLine },
    activeLineIds,
  }
}
