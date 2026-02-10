import type { DOMRectLike, TokenRect } from '@/editor/types'

type TokenRange = { id: string; lineId: string; start: number; end: number }

type CacheKey = string
const rectCache = new Map<CacheKey, TokenRect[]>()

const toRectLike = (rect: DOMRect): DOMRectLike => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
})

export function measureTokenRects(
  editableRoot: HTMLElement,
  tokenRanges: TokenRange[],
  cacheKey: string
): Promise<TokenRect[]> {
  const cached = rectCache.get(cacheKey)
  if (cached) return Promise.resolve(cached)

  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      const rootRect = editableRoot.getBoundingClientRect()
      const next: TokenRect[] = []

      for (const token of tokenRanges) {
        const lineElement = editableRoot.querySelector<HTMLDivElement>(`[data-line-id="${token.lineId}"]`)
        if (!lineElement) continue
        const walker = document.createTreeWalker(lineElement, NodeFilter.SHOW_TEXT)
        let node: Node | null = walker.nextNode()
        let offset = 0
        let startNode: Node | null = null
        let endNode: Node | null = null
        let startOffset = 0
        let endOffset = 0
        while (node) {
          const len = node.textContent?.length ?? 0
          const nextOffset = offset + len
          if (!startNode && token.start >= offset && token.start <= nextOffset) {
            startNode = node
            startOffset = token.start - offset
          }
          if (!endNode && token.end >= offset && token.end <= nextOffset) {
            endNode = node
            endOffset = token.end - offset
            break
          }
          offset = nextOffset
          node = walker.nextNode()
        }
        if (!startNode || !endNode) continue
        const range = document.createRange()
        range.setStart(startNode, Math.max(0, startOffset))
        range.setEnd(endNode, Math.max(0, endOffset))
        for (const rect of Array.from(range.getClientRects())) {
          next.push({
            id: token.id,
            lineId: token.lineId,
            rect: {
              ...toRectLike(rect),
              left: rect.left - rootRect.left,
              top: rect.top - rootRect.top,
            },
          })
        }
      }

      rectCache.set(cacheKey, next)
      resolve(next)
    })
  })
}
