import type { SelectionSnapshot } from '@/editor/types'

function resolvePoint(root: HTMLElement, node: Node | null, offset: number) {
  if (!node || !root.contains(node)) {
    return { lineId: null, offset: 0 }
  }
  const lineElement =
    node instanceof Element ? node.closest<HTMLDivElement>('.line') : node.parentElement?.closest<HTMLDivElement>('.line')
  if (!lineElement) {
    return { lineId: null, offset: 0 }
  }
  const lineId = lineElement.dataset.lineId ?? null
  if (!lineId) {
    return { lineId: null, offset: 0 }
  }

  const range = root.ownerDocument.createRange()
  range.setStart(lineElement, 0)
  try {
    range.setEnd(node, offset)
  } catch {
    range.setEnd(lineElement, lineElement.childNodes.length)
  }

  return {
    lineId,
    offset: Math.max(0, range.toString().length),
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

  const doc =
    anchor.nodeType === 9
      ? (anchor as unknown as Document)
      : anchor.ownerDocument

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

  return {
    anchor: resolvePoint(root, selection.anchorNode, selection.anchorOffset),
    focus: resolvePoint(root, selection.focusNode, selection.focusOffset),
    direction: detectDirection(selection),
    isCollapsed: selection.isCollapsed,
  }
}
