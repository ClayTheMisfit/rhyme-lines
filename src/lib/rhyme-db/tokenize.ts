const PUNCTUATION_REGEX = /^[.,!?;:"()\[\]{}<>]+|[.,!?;:"()\[\]{}<>]+$/g
const BOUNDARY_REGEX = /[\s.,!?;:"()\[\]{}<>]/

export const normalizeToken = (raw: string) => {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) {
    return ''
  }
  return trimmed.replace(PUNCTUATION_REGEX, '')
}

const isBoundary = (char: string) => BOUNDARY_REGEX.test(char)

export const getCaretWord = (text: string, caretIndex: number): string | null => {
  if (!text) return null
  const safeIndex = Math.min(Math.max(caretIndex, 0), text.length)

  let start = safeIndex
  while (start > 0 && !isBoundary(text[start - 1])) {
    start -= 1
  }

  let end = safeIndex
  while (end < text.length && !isBoundary(text[end])) {
    end += 1
  }

  const raw = text.slice(start, end)
  const normalized = normalizeToken(raw)
  return normalized ? normalized : null
}

export const getLineLastWord = (lineText: string): string | null => {
  if (!lineText) return null
  let index = lineText.length - 1

  while (index >= 0 && isBoundary(lineText[index])) {
    index -= 1
  }

  if (index < 0) return null

  let start = index
  while (start >= 0 && !isBoundary(lineText[start])) {
    start -= 1
  }

  const raw = lineText.slice(start + 1, index + 1)
  const normalized = normalizeToken(raw)
  return normalized ? normalized : null
}
