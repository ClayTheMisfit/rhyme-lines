import type { OverlayToken } from '@/components/editor/SyllableOverlay'
import type { RhymeTokenPosition } from '@/lib/overlay/types'

type LayoutKey = string

type CachedLine = {
  layoutKey: LayoutKey
  contentSignature: string
  tokens: OverlayToken[]
  lineOffset: number
  rhymeTokens?: RhymeTokenPosition[]
}

type DocCache = Map<string, CachedLine>

export class GeometryCache {
  private store = new Map<string, DocCache>()

  get(docId: string, lineId: string, layoutKey: LayoutKey, contentSignature: string) {
    const doc = this.store.get(docId)
    if (!doc) return null
    const entry = doc.get(lineId)
    if (!entry) return null
    if (entry.layoutKey !== layoutKey) return null
    if (entry.contentSignature !== contentSignature) return null
    return entry
  }

  set(
    docId: string,
    lineId: string,
    layoutKey: LayoutKey,
    contentSignature: string,
    payload: { tokens: OverlayToken[]; lineOffset: number; rhymeTokens?: RhymeTokenPosition[] }
  ) {
    if (!this.store.has(docId)) {
      this.store.set(docId, new Map())
    }
    const doc = this.store.get(docId)
    if (!doc) return
    doc.set(lineId, {
      layoutKey,
      contentSignature,
      tokens: payload.tokens,
      lineOffset: payload.lineOffset,
      rhymeTokens: payload.rhymeTokens,
    })
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
