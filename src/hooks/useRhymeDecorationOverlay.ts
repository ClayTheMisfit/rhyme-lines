import { useEffect, useMemo, useState } from 'react'
import type { RhymeDecorationSnapshot } from '@/lib/rhyme/rhymeDecorations'

type ViewportRange = { start: number; end: number }

export type RhymeDecorationRect = {
  id: string
  lineId: string
  familyIndex: number
  underline: boolean
  rect: {
    left: number
    top: number
    width: number
    height: number
  }
}

type UseRhymeDecorationOverlayArgs = {
  enabled: boolean
  editorRef: React.RefObject<HTMLDivElement | null>
  lineElementsRef: React.RefObject<HTMLDivElement[]>
  decorations: RhymeDecorationSnapshot
  viewportRange: ViewportRange
  lineVersion: number
}

const isInViewport = (index: number, start: number, end: number) => {
  if (Number.isNaN(index)) return false
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true
  return index >= start && index <= end
}

export function useRhymeDecorationOverlay({
  enabled,
  editorRef,
  lineElementsRef,
  decorations,
  viewportRange,
  lineVersion,
}: UseRhymeDecorationOverlayArgs) {
  const [rects, setRects] = useState<RhymeDecorationRect[]>([])

  const tokensByLine = useMemo(() => decorations.tokensByLine, [decorations])

  useEffect(() => {
    if (!enabled) {
      setRects([])
      return
    }
    const root = editorRef.current
    const lines = lineElementsRef.current
    if (!root || !lines.length) {
      setRects([])
      return
    }

    let rafId: number | null = null

    const measure = () => {
      const rootRect = root.getBoundingClientRect()
      const nextRects: RhymeDecorationRect[] = []

      const measureForSpan = (lineElement: HTMLDivElement, start: number, end: number) => {
        const walker = document.createTreeWalker(lineElement, NodeFilter.SHOW_TEXT)
        let node: Node | null = walker.nextNode()
        let offset = 0
        let startNode: Node | null = null
        let endNode: Node | null = null
        let startOffset = 0
        let endOffset = 0

        while (node) {
          const length = node.textContent?.length ?? 0
          const nextOffset = offset + length
          if (!startNode && start >= offset && start <= nextOffset) {
            startNode = node
            startOffset = start - offset
          }
          if (!endNode && end >= offset && end <= nextOffset) {
            endNode = node
            endOffset = end - offset
            break
          }
          offset = nextOffset
          node = walker.nextNode()
        }

        if (startNode && endNode) {
          const range = document.createRange()
          range.setStart(startNode, Math.max(0, startOffset))
          range.setEnd(endNode, Math.max(0, endOffset))
          return range
        }
        return null
      }

      for (const lineElement of lines) {
        const lineId = lineElement.dataset.lineId ?? ''
        if (!lineId) continue
        const lineIndex = Number.parseInt(lineElement.dataset.lineIndex ?? '-1', 10)
        if (!isInViewport(lineIndex, viewportRange.start, viewportRange.end)) continue
        const lineTokens = tokensByLine.get(lineId)
        if (!lineTokens?.length) continue

        lineTokens.forEach((token, tokenIndex) => {
          const range = measureForSpan(lineElement, token.start, token.end)
          if (!range) return
          const rectList = Array.from(range.getClientRects())
          rectList.forEach((rect, rectIndex) => {
            nextRects.push({
              id: `${lineId}-${tokenIndex}-${rectIndex}`,
              lineId,
              familyIndex: token.familyIndex,
              underline: token.underline,
              rect: {
                left: rect.left - rootRect.left,
                top: rect.top - rootRect.top,
                width: rect.width,
                height: rect.height,
              },
            })
          })
          range.detach()
        })
      }

      setRects(nextRects)
    }

    rafId = window.requestAnimationFrame(measure)

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [decorations, enabled, editorRef, lineElementsRef, lineVersion, tokensByLine, viewportRange.end, viewportRange.start])

  return rects
}
