import type { OverlayToken } from '@/components/editor/SyllableOverlay'

type GeometryEntry = {
  layoutKey: string
  contentSignature: string
  tokens: OverlayToken[]
  measuredAt: number
}

const geometryCache = new Map<string, Map<string, GeometryEntry>>()

export const makeLayoutKey = (parts: Array<string | number>) => parts.join('|')

export const readCachedGeometry = (
  docId: string,
  lineId: string,
  layoutKey: string,
  contentSignature: string
): OverlayToken[] | null => {
  const docCache = geometryCache.get(docId)
  if (!docCache) return null
  const cached = docCache.get(lineId)
  if (!cached) return null
  if (cached.layoutKey !== layoutKey) return null
  if (cached.contentSignature !== contentSignature) return null
  return cached.tokens
}

export const writeCachedGeometry = (
  docId: string,
  lineId: string,
  layoutKey: string,
  contentSignature: string,
  tokens: OverlayToken[]
) => {
  const existing = geometryCache.get(docId) ?? new Map<string, GeometryEntry>()
  existing.set(lineId, {
    layoutKey,
    contentSignature,
    tokens,
    measuredAt: Date.now(),
  })
  geometryCache.set(docId, existing)
}

export const invalidateDocGeometry = (docId: string) => {
  geometryCache.delete(docId)
}

export const invalidateLineGeometry = (docId: string, lineId: string) => {
  const docCache = geometryCache.get(docId)
  if (!docCache) return
  docCache.delete(lineId)
  if (!docCache.size) {
    geometryCache.delete(docId)
  }
}
