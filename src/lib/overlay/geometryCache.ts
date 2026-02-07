type LayoutKey = string

type CachedLine = {
  layoutKey: LayoutKey
  contentSignature: string
  lineOffset?: number
  overlays: Partial<Record<OverlayKind, { tokens: unknown[] }>>
}

type DocCache = Map<string, CachedLine>

export type OverlayKind = 'syllables' | 'rhymes'

export class GeometryCache {
  private store = new Map<string, DocCache>()

  get<T>(docId: string, lineId: string, layoutKey: LayoutKey, contentSignature: string, overlay: OverlayKind) {
    const doc = this.store.get(docId)
    if (!doc) return null
    const entry = doc.get(lineId)
    if (!entry) return null
    if (entry.layoutKey !== layoutKey) return null
    if (entry.contentSignature !== contentSignature) return null
    const overlayEntry = entry.overlays[overlay]
    if (!overlayEntry) return null
    if (overlay === 'syllables' && typeof entry.lineOffset !== 'number') return null
    return { tokens: overlayEntry.tokens as T[], lineOffset: entry.lineOffset }
  }

  set(
    docId: string,
    lineId: string,
    layoutKey: LayoutKey,
    contentSignature: string,
    overlay: OverlayKind,
    payload: { tokens: unknown[]; lineOffset?: number }
  ) {
    if (!this.store.has(docId)) {
      this.store.set(docId, new Map())
    }
    const doc = this.store.get(docId)
    if (!doc) return
    const existing = doc.get(lineId)
    const resetEntry =
      !existing || existing.layoutKey !== layoutKey || existing.contentSignature !== contentSignature
    const entry: CachedLine = resetEntry
      ? { layoutKey, contentSignature, overlays: {} }
      : { ...existing, overlays: { ...existing.overlays } }

    entry.overlays[overlay] = { tokens: payload.tokens }
    if (payload.lineOffset !== undefined) {
      entry.lineOffset = payload.lineOffset
    }

    doc.set(lineId, entry)
  }

  invalidateLine(docId: string, lineId: string) {
    const doc = this.store.get(docId)
    if (!doc) return
    doc.delete(lineId)
  }

  invalidateDoc(docId: string) {
    this.store.delete(docId)
  }
}
