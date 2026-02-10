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
  if (selection.anchorNode === selection.focusNode) {
    return selection.anchorOffset <= selection.focusOffset ? 'forward' : 'backward'
  }
  const probe = selection.anchorNode?.ownerDocument.createRange()
  if (!probe || !selection.anchorNode || !selection.focusNode) return 'forward'
  probe.setStart(selection.anchorNode, selection.anchorOffset)
  probe.setEnd(selection.focusNode, selection.focusOffset)
  return probe.collapsed ? 'backward' : 'forward'
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
