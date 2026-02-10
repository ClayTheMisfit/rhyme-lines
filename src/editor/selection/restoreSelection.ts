import type { SelectionPoint, SelectionSnapshot } from '@/editor/types'

function findPointNode(root: HTMLElement, point: SelectionPoint): { node: Node; offset: number } | null {
  if (!point.lineId) return null
  const line = root.querySelector<HTMLDivElement>(`[data-line-id="${point.lineId}"]`)
  if (!line) return null

  const target = Math.max(0, point.offset)
  const walker = root.ownerDocument.createTreeWalker(line, NodeFilter.SHOW_TEXT)
  let consumed = 0
  let textNode: Node | null = walker.nextNode()

  while (textNode) {
    const length = textNode.textContent?.length ?? 0
    if (consumed + length >= target) {
      return { node: textNode, offset: Math.max(0, target - consumed) }
    }
    consumed += length
    textNode = walker.nextNode()
  }

  return { node: line, offset: line.childNodes.length }
}

export function restoreSelection(root: HTMLElement, snapshot: SelectionSnapshot | null): boolean {
  if (!snapshot) return false
  const selection = root.ownerDocument.getSelection()
  if (!selection) return false

  const anchor = findPointNode(root, snapshot.anchor)
  const focus = findPointNode(root, snapshot.focus)
  if (!anchor || !focus) return false

  const range = root.ownerDocument.createRange()
  range.setStart(anchor.node, anchor.offset)
  range.setEnd(focus.node, focus.offset)

  selection.removeAllRanges()
  selection.addRange(range)

  if (snapshot.direction === 'backward' && !snapshot.isCollapsed && typeof selection.extend === 'function') {
    selection.collapse(focus.node, focus.offset)
    selection.extend(anchor.node, anchor.offset)
  }

  return true
}
