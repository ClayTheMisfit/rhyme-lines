import type { SelectionSnapshot } from '@/editor/types'
import { getLineElementFromNode, getPlainTextOffsetWithinLine } from '@/lib/editor/plainText'

function resolvePoint(root: HTMLElement, node: Node | null, offset: number) {
  const lineElement = getLineElementFromNode(root, node)
  if (!lineElement || !node) {
    return { lineId: null, offset: 0 }
  }

  const lineId = lineElement.dataset.lineId ?? null
  if (!lineId) {
    return { lineId: null, offset: 0 }
  }

  const cleanOffset = getPlainTextOffsetWithinLine(lineElement, node, offset)
  if (cleanOffset === null) {
    return { lineId: null, offset: 0 }
  }

  return {
    lineId,
    offset: Math.max(0, cleanOffset),
  }
}

function detectDirection(selection: Selection): 'forward' | 'backward' {
  if (selection.isCollapsed) return 'forward'
  const anchor = selection.anchorNode
  const focus = selection.focusNode
  if (anchor === focus) {
    return selection.anchorOffset <= selection.focusOffset ? 'forward' : 'backward'
  }

  if (!anchor || !focus) return 'forward'

  const doc = anchor.nodeType === 9 ? (anchor as unknown as Document) : anchor.ownerDocument

  if (!doc) return 'forward'

  const probe = doc.createRange()

  try {
    probe.setStart(anchor, selection.anchorOffset)
    probe.setEnd(focus, selection.focusOffset)
    return probe.collapsed ? 'backward' : 'forward'
  } catch {
    return 'forward'
  }
}

export function serializeSelection(root: HTMLElement, selection: Selection | null): SelectionSnapshot | null {
  if (!selection || selection.rangeCount === 0) return null
  if (!selection.anchorNode || !root.contains(selection.anchorNode)) return null
  if (!selection.focusNode || !root.contains(selection.focusNode)) return null

  const anchor = resolvePoint(root, selection.anchorNode, selection.anchorOffset)
  const focus = resolvePoint(root, selection.focusNode, selection.focusOffset)
  if (!anchor.lineId || !focus.lineId) return null
  if (anchor.offset < 0 || focus.offset < 0) return null

  return {
    anchor,
    focus,
    direction: detectDirection(selection),
    isCollapsed: selection.isCollapsed,
  }
}
