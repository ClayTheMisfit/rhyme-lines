/**
 * Editor serialization utilities for preserving line breaks across save/restore
 */

/**
 * Serialize editor content to plain text with proper line breaks
 * Converts DOM structure to text with \n for line breaks
 */
export function serializeFromEditor(el: HTMLElement): string {
  if (!el) return ''

  // Use a more reliable approach: walk the DOM and convert <br> to \n
  const walker = document.createTreeWalker(
    el,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    null
  )

  let result = ''
  let node: Node | null = walker.nextNode()

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Add text content, replacing &nbsp; with spaces
      result += (node.textContent || '').replace(/\u00A0/g, ' ')
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      if (element.tagName === 'BR') {
        // Convert <br> to newline
        result += '\n'
      } else if (element.tagName === 'DIV' && element.classList.contains('line')) {
        // Add newline after each line div (except if it's the last child)
        if (result && !result.endsWith('\n')) {
          result += '\n'
        }
      } else if (element.tagName === 'DIV' || element.tagName === 'P') {
        // Add newline before block elements (except if it's the first child)
        if (result && !result.endsWith('\n')) {
          result += '\n'
        }
      }
    }
    node = walker.nextNode()
  }

  // Normalize line endings: convert \r\n and \r to \n
  result = result.replace(/\r\n?/g, '\n')
  
  // Remove trailing whitespace from each line but preserve empty lines
  result = result.split('\n').map(line => line.trimEnd()).join('\n')
  
  return result
}

/**
 * Hydrate editor content from plain text with line breaks
 * Converts \n to <br> elements for proper rendering
 */
export function hydrateEditorFromText(el: HTMLElement, text: string): void {
  if (!el || !text) {
    el.innerHTML = ''
    return
  }

  // Normalize line endings
  const normalizedText = text.replace(/\r\n?/g, '\n')
  
  // Convert \n to <div class="line"> elements for proper line break rendering
  // Handle empty lines by ensuring they become <br> elements
  const lines = normalizedText.split('\n')
  const html = lines
    .map((line, index) => {
      // Empty lines should become <br> to preserve them
      if (line === '') return '<div class="line"><br></div>'
      // Escape HTML characters in text content and wrap in line div
      return `<div class="line">${escapeHtml(line)}</div>`
    })
    .join('')
  
  // Set innerHTML to preserve line breaks
  el.innerHTML = html
  
  // Ensure cursor is at the end
  const range = document.createRange()
  const sel = window.getSelection()
  
  if (el.lastChild) {
    range.setStartAfter(el.lastChild)
    range.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(range)
  }
}

/**
 * Escape HTML characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Check if content has line breaks (for migration detection)
 */
export function hasLineBreaks(text: string): boolean {
  return text.includes('\n') || text.includes('\r')
}

/**
 * Migrate old content format to new format
 * Attempts to detect HTML vs plain text and convert appropriately
 */
export function migrateOldContent(oldContent: string): string {
  if (!oldContent) return ''
  
  // If it already has line breaks, it's likely already in the correct format
  if (hasLineBreaks(oldContent)) {
    return oldContent
  }
  
  // If it contains HTML tags, extract text content
  if (oldContent.includes('<') && oldContent.includes('>')) {
    const temp = document.createElement('div')
    temp.innerHTML = oldContent
    return temp.textContent || oldContent
  }
  
  // Otherwise, return as-is (can't infer lost line breaks)
  return oldContent
}