export interface ActiveWord {
  word: string
  startOffset: number
  endOffset: number
  isAtCaret: boolean
}

const WORD_REGEX = /\b[\p{L}']+\b/gu
const THROTTLE_MS = 50

let lastThrottleTime = 0
let lastResult: ActiveWord | null = null

export function getActiveWord(editorElement: HTMLElement | null): ActiveWord | null {
  if (!editorElement) return null

  const now = Date.now()
  if (now - lastThrottleTime < THROTTLE_MS && lastResult) {
    return lastResult
  }

  lastThrottleTime = now

  try {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      lastResult = getLastWord(editorElement)
      return lastResult
    }

    const range = selection.getRangeAt(0)
    
    // Check if selection is within our editor
    if (!editorElement.contains(range.commonAncestorContainer)) {
      lastResult = getLastWord(editorElement)
      return lastResult
    }

    // Get word at caret position
    const wordAtCaret = getWordAtCaret(range, editorElement)
    if (wordAtCaret) {
      lastResult = wordAtCaret
      return lastResult
    }

    // Fallback to last word
    lastResult = getLastWord(editorElement)
    return lastResult

  } catch (error) {
    console.warn('Error getting active word:', error)
    lastResult = getLastWord(editorElement)
    return lastResult
  }
}

function getWordAtCaret(range: Range, editorElement: HTMLElement): ActiveWord | null {
  const text = editorElement.textContent || ''
  const caretOffset = getCaretOffset(range, editorElement)
  
  if (caretOffset === -1) return null

  // Find word boundaries around caret
  const beforeCaret = text.slice(0, caretOffset)
  const afterCaret = text.slice(caretOffset)
  
  // Look for word characters before caret
  const beforeMatch = beforeCaret.match(/\b[\p{L}']+$/u)
  const afterMatch = afterCaret.match(/^[\p{L}']+\b/u)
  
  if (!beforeMatch && !afterMatch) return null
  
  const startOffset = beforeMatch 
    ? caretOffset - beforeMatch[0].length 
    : caretOffset
  const endOffset = afterMatch 
    ? caretOffset + afterMatch[0].length 
    : caretOffset
  
  const word = text.slice(startOffset, endOffset).trim()
  
  if (!word || !WORD_REGEX.test(word)) return null
  
  return {
    word,
    startOffset,
    endOffset,
    isAtCaret: true,
  }
}

function getLastWord(editorElement: HTMLElement): ActiveWord | null {
  const text = editorElement.textContent || ''
  if (!text.trim()) return null

  // Find the last word in the text
  const words = Array.from(text.matchAll(WORD_REGEX))
  if (words.length === 0) return null

  const lastMatch = words[words.length - 1]
  if (!lastMatch) return null

  return {
    word: lastMatch[0],
    startOffset: lastMatch.index!,
    endOffset: lastMatch.index! + lastMatch[0].length,
    isAtCaret: false,
  }
}

function getCaretOffset(range: Range, editorElement: HTMLElement): number {
  try {
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(editorElement)
    preCaretRange.setEnd(range.endContainer, range.endOffset)
    return preCaretRange.toString().length
  } catch {
    return -1
  }
}

// Throttled event listener setup
export function setupCaretListener(
  editorElement: HTMLElement,
  callback: (activeWord: ActiveWord | null) => void
): () => void {
  let timeoutId: number | null = null

  const throttledCallback = () => {
    if (timeoutId) return
    
    timeoutId = window.setTimeout(() => {
      const activeWord = getActiveWord(editorElement)
      callback(activeWord)
      timeoutId = null
    }, THROTTLE_MS)
  }

  const events = ['keyup', 'click', 'selectionchange'] as const
  
  events.forEach(event => {
    if (event === 'selectionchange') {
      document.addEventListener(event, throttledCallback)
    } else {
      editorElement.addEventListener(event, throttledCallback)
    }
  })

  return () => {
    if (timeoutId) {
      window.clearTimeout(timeoutId)
    }
    
    events.forEach(event => {
      if (event === 'selectionchange') {
        document.removeEventListener(event, throttledCallback)
      } else {
        editorElement.removeEventListener(event, throttledCallback)
      }
    })
  }
}
