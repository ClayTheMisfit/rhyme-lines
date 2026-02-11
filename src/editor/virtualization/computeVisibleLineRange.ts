import type { VisibleLineRange } from '@/editor/types'

type Args = {
  scrollTop: number
  viewportHeight: number
  estimatedLineHeight: number
  lineCount: number
  overscan: number
}

export function computeVisibleLineRange({
  scrollTop,
  viewportHeight,
  estimatedLineHeight,
  lineCount,
  overscan,
}: Args): VisibleLineRange {
  if (lineCount <= 0) return { startLine: 0, endLine: 0 }
  const lineHeight = Math.max(1, estimatedLineHeight)
  const start = Math.floor(scrollTop / lineHeight)
  const end = Math.ceil((scrollTop + viewportHeight) / lineHeight)
  const unclampedStart = Math.max(0, start - overscan)
  const endLine = Math.min(lineCount - 1, end + overscan)
  return {
    startLine: Math.min(unclampedStart, endLine),
    endLine,
  }
}
