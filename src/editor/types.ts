import type { LineInput } from '@/lib/analysis/compute'

export type SelectionPoint = {
  lineId: string | null
  offset: number
}

export type SelectionSnapshot = {
  anchor: SelectionPoint
  focus: SelectionPoint
  direction: 'forward' | 'backward'
  isCollapsed: boolean
}

export type EditorRefs = {
  rootRef: React.RefObject<HTMLDivElement | null>
  editableRef: React.RefObject<HTMLDivElement | null>
  overlayRef: React.RefObject<HTMLDivElement | null>
  scrollRef: React.RefObject<HTMLElement | null>
}

export type Decoration = {
  id: string
  kind: string
  lineId: string
  range: { start: number; end: number }
  styleKey?: string
}

export type DecorationsByLine<TDecoration = Decoration> = Map<string, TDecoration[]>

export type DOMRectLike = {
  left: number
  top: number
  width: number
  height: number
}

export type TokenRect = {
  id: string
  lineId: string
  rect: DOMRectLike
}

export type VisibleLineRange = {
  startLine: number
  endLine: number
}

export type EditorLineInput = LineInput
