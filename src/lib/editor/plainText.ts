export type ActiveEditorToken = {
  word: string
  start: number
  end: number
  lineId: string | null
  lineIndex: number
  caretIndex: number
}

const IGNORED_TEXT_SELECTOR = [
  '[data-editor-overlay]',
  '[data-syllable-badge]',
  '[data-rhyme-overlay]',
  '[data-line-totals-gutter]',
  '[data-placeholder-line="true"]',
  '[data-layer="overlay"]',
  '[data-layer="rhyme-decoration"]',
  '[aria-hidden="true"]',
  '[contenteditable="false"]',
].join(',')

const TOKEN_REGEX = /[\p{L}\p{N}']+/gu

// Cache for line lengths to avoid O(n²) in getEditorPlainTextIndexFromSelection
const lineLengthCache = new Map<HTMLElement, number>()

export const normalizeEditorTextNode = (text: string) => text.replace(/\u00A0/g, ' ')

/**
 * Invalidate the cached length for a specific line element.
 * Call this when a line's content changes.
 */
export function invalidateLineCache(lineElement: HTMLElement): void {
  lineLengthCache.delete(lineElement)
}

/**
 * Clear all cached line lengths.
 */
export function clearLineCache(): void {
  lineLengthCache.clear()
}

export function shouldIgnoreEditorTextNode(node: Node | null): boolean {
  if (!node) return true
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  return Boolean(element?.closest(IGNORED_TEXT_SELECTOR))
}

export function getLinePlainText(lineElement: HTMLElement, useCache = false): string {
  const doc = lineElement.ownerDocument
  const walker = doc.createTreeWalker(lineElement, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return shouldIgnoreEditorTextNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    },
  })

  let text = ''
  let node: Node | null = walker.nextNode()
  while (node) {
    text += normalizeEditorTextNode(node.textContent ?? '')
    node = walker.nextNode()
  }
  text = text.replace(/\r\n?/g, '\n')

  if (useCache) {
    lineLengthCache.set(lineElement, text.length)
  }

  return text
}

/**
 * Get the cached length of a line, or compute and cache it if not present.
 */
function getLinePlainTextLength(lineElement: HTMLElement): number {
  const cached = lineLengthCache.get(lineElement)
  if (cached !== undefined) return cached

  const text = getLinePlainText(lineElement, true)
  return text.length
}

export function getEditorLineElements(editorRoot: HTMLElement): HTMLElement[] {
  return Array.from(editorRoot.querySelectorAll<HTMLElement>('.line')).filter(
    (line) => line.dataset.placeholderLine !== 'true' && !shouldIgnoreEditorTextNode(line)
  )
}

export function getEditorPlainText(editorRoot: HTMLElement): string {
  const lineElements = getEditorLineElements(editorRoot)
  if (lineElements.length > 0) {
    return lineElements.map((line) => getLinePlainText(line)).join('\n')
  }

  let result = ''
  const walker = editorRoot.ownerDocument.createTreeWalker(editorRoot, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return shouldIgnoreEditorTextNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    },
  })

  let node: Node | null = walker.nextNode()
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += normalizeEditorTextNode(node.textContent ?? '')
    } else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR') {
      result += '\n'
    }
    node = walker.nextNode()
  }

  return result.replace(/\r\n?/g, '\n')
}

function appendPlainTextFromSubtree(node: Node): string {
  if (shouldIgnoreEditorTextNode(node)) return ''
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeEditorTextNode(node.textContent ?? '')
  }

  let text = ''
  node.childNodes.forEach((child) => {
    text += appendPlainTextFromSubtree(child)
  })
  return text
}

export function getPlainTextOffsetWithinLine(lineElement: HTMLElement, targetNode: Node, targetOffset: number): number | null {
  if (!lineElement.contains(targetNode)) return null
  if (shouldIgnoreEditorTextNode(targetNode)) return null

  let offset = 0
  let found = false

  const visit = (node: Node): void => {
    if (found || shouldIgnoreEditorTextNode(node)) return

    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = normalizeEditorTextNode(node.textContent ?? '')
        offset += Math.min(Math.max(targetOffset, 0), text.length)
      } else {
        const children = Array.from(node.childNodes).slice(0, Math.max(0, targetOffset))
        for (const child of children) {
          offset += appendPlainTextFromSubtree(child).length
        }
      }
      found = true
      return
    }

    if (node.nodeType === Node.TEXT_NODE) {
      offset += normalizeEditorTextNode(node.textContent ?? '').length
      return
    }

    node.childNodes.forEach(visit)
  }

  visit(lineElement)
  return found ? offset : null
}

export function getLineElementFromNode(editorRoot: HTMLElement, node: Node | null): HTMLElement | null {
  if (!node || !editorRoot.contains(node) || shouldIgnoreEditorTextNode(node)) return null
  const element = node instanceof Element ? node : node.parentElement
  const lineElement = element?.closest<HTMLElement>('.line') ?? null
  if (!lineElement || !editorRoot.contains(lineElement) || lineElement.dataset.placeholderLine === 'true') return null
  return lineElement
}

export function getEditorPlainTextIndexFromSelection(
  editorRoot: HTMLElement,
  selection: Selection | null = editorRoot.ownerDocument.getSelection(),
  options?: {
    precomputedLineIndex?: number
    cachedLineLengths?: Map<HTMLElement, number>
  }
): { index: number; lineElement: HTMLElement; lineIndex: number; lineOffset: number } | null {
  if (!selection || selection.rangeCount === 0 || !selection.focusNode) return null
  const lineElement = getLineElementFromNode(editorRoot, selection.focusNode)
  if (!lineElement) return null

  const lineOffset = getPlainTextOffsetWithinLine(lineElement, selection.focusNode, selection.focusOffset)
  if (lineOffset === null) return null

  const lines = getEditorLineElements(editorRoot)
  const lineIndex = options?.precomputedLineIndex ?? lines.findIndex((line) => line === lineElement)
  if (lineIndex === -1) return null

  // Use O(n) with O(1) lookups instead of O(n²)
  let previousLength = 0
  for (let i = 0; i < lineIndex; i++) {
    const lineLen = options?.cachedLineLengths
      ? options.cachedLineLengths.get(lines[i]) ?? getLinePlainTextLength(lines[i])
      : getLinePlainTextLength(lines[i])
    previousLength += lineLen + 1 // +1 for newline
  }

  return {
    index: previousLength + lineOffset,
    lineElement,
    lineIndex,
    lineOffset,
  }
}

export function tokenizePlainText(text: string): Array<{ word: string; start: number; end: number }> {
  return Array.from(text.matchAll(TOKEN_REGEX), (match) => ({
    word: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }))
}

export function getActiveTokenFromCaret(
  selection: Selection | null,
  editorRoot: HTMLElement,
  canonicalText = getEditorPlainText(editorRoot),
  tokens = tokenizePlainText(canonicalText)
): ActiveEditorToken | null {
  const caret = getEditorPlainTextIndexFromSelection(editorRoot, selection)
  if (!caret) return null

  const active =
    tokens.find((token) => caret.index >= token.start && caret.index <= token.end) ??
    tokens.find((token) => token.start >= caret.index) ??
    [...tokens].reverse().find((token) => token.end <= caret.index)

  if (!active) return null

  return {
    word: active.word,
    start: active.start,
    end: active.end,
    lineId: caret.lineElement.dataset.lineId ?? null,
    lineIndex: caret.lineIndex,
    caretIndex: caret.index,
  }
}
