import { getActiveTokenFromCaret, getEditorPlainText, tokenizePlainText } from '@/lib/editor/plainText'

export interface ActiveWord {
  word: string
  startOffset: number
  endOffset: number
  isAtCaret: boolean
}

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
    if (!selection || selection.rangeCount === 0 || !selection.focusNode || !editorElement.contains(selection.focusNode)) {
      lastResult = getLastWord(editorElement)
      return lastResult
    }

    const text = getEditorPlainText(editorElement)
    const token = getActiveTokenFromCaret(selection, editorElement, text)
    if (token) {
      lastResult = {
        word: token.word,
        startOffset: token.start,
        endOffset: token.end,
        isAtCaret: true,
      }
      return lastResult
    }

    lastResult = getLastWord(editorElement)
    return lastResult
  } catch (error) {
    console.warn('Error getting active word:', error)
    lastResult = getLastWord(editorElement)
    return lastResult
  }
}

function getLastWord(editorElement: HTMLElement): ActiveWord | null {
  const text = getEditorPlainText(editorElement)
  if (!text.trim()) return null

  const words = tokenizePlainText(text)
  const lastMatch = words[words.length - 1]
  if (!lastMatch) return null

  return {
    word: lastMatch.word,
    startOffset: lastMatch.start,
    endOffset: lastMatch.end,
    isAtCaret: false,
  }
}

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
