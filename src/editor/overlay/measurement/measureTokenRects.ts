import type { DOMRectLike, TokenRect } from '@/editor/types'
import { normalizeEditorTextNode, shouldIgnoreEditorTextNode } from '@/lib/editor/plainText'

type TokenRange = { id: string; lineId: string; start: number; end: number }

type CacheKey = string
const rectCache = new Map<CacheKey, TokenRect[]>()
const MAX_CACHE_ENTRIES = 300

const cacheGet = (cacheKey: CacheKey): TokenRect[] | undefined => {
  const value = rectCache.get(cacheKey)
  if (!value) return undefined
  // Refresh recency for simple LRU semantics.
  rectCache.delete(cacheKey)
  rectCache.set(cacheKey, value)
  return value
}

const cacheSet = (cacheKey: CacheKey, value: TokenRect[]) => {
  if (rectCache.has(cacheKey)) {
    rectCache.delete(cacheKey)
  }
  rectCache.set(cacheKey, value)

  if (rectCache.size <= MAX_CACHE_ENTRIES) return

  const oldestKey = rectCache.keys().next().value as CacheKey | undefined
  if (oldestKey !== undefined) {
    rectCache.delete(oldestKey)
  }
}

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
  const doc = editableRoot.ownerDocument
  const cached = cacheGet(cacheKey)
  if (cached) return Promise.resolve(cached)

  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      const rootRect = editableRoot.getBoundingClientRect()
      const next: TokenRect[] = []

      for (const token of tokenRanges) {
        const lineElement = editableRoot.querySelector<HTMLDivElement>(`[data-line-id="${token.lineId}"]`)
        if (!lineElement) continue
        const walker = doc.createTreeWalker(lineElement, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            return shouldIgnoreEditorTextNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
          },
        })
        let node: Node | null = walker.nextNode()
        let offset = 0
        let startNode: Node | null = null
        let endNode: Node | null = null
        let startOffset = 0
        let endOffset = 0
        while (node) {
          const len = normalizeEditorTextNode(node.textContent ?? '').length
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
        const range = doc.createRange()
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

      cacheSet(cacheKey, next)
      resolve(next)
    })
  })
}
