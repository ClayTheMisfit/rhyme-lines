export type TargetSource = 'caret' | 'lastTyped'

export interface TargetWordInput {
  text: string
  caretIndex?: number | null
  selection?: { start: number; end: number } | null
  lastTypedWord?: string | null
  minLength?: number
  lineId?: string
  sourceHint?: TargetSource
}

export interface RhymeTarget {
  word: string
  normalized: string
  lineId?: string
  source: TargetSource
}

const DEFAULT_MIN_LENGTH = 2
const NUMERIC_ONLY = /^[0-9]+$/
const INVALID_BOUNDARY = /[.,!?;:"“”‘’()[\]{}<>]+/g
const APOSTROPHE_VARIANTS = /[’‘`´]/g
const HYPHEN_VARIANTS = /[‐‑–—]/g

function normalizeToken(token: string): string {
  const squashed = token
    .replace(APOSTROPHE_VARIANTS, "'")
    .replace(HYPHEN_VARIANTS, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return squashed.replace(INVALID_BOUNDARY, '').toLowerCase()
}

function isValidToken(token: string, minLength: number): boolean {
  if (!token) return false
  if (NUMERIC_ONLY.test(token)) return false
  if (token.length < minLength) return false
  return true
}

function extractWordAtCaret(text: string, caretIndex: number, minLength: number): string | null {
  if (caretIndex < 0 || caretIndex > text.length) return null
  const before = text.slice(0, caretIndex)
  const after = text.slice(caretIndex)

  const beforeMatch = before.match(/[\p{L}\p{M}'-]+$/u)
  const afterMatch = after.match(/^[\p{L}\p{M}'-]+/u)

  const raw =
    (beforeMatch ? beforeMatch[0] : '') + (afterMatch ? afterMatch[0] : '')

  const normalized = normalizeToken(raw)
  if (!isValidToken(normalized, minLength)) return null
  return normalized
}

function pickFallbackWord(text: string, minLength: number): string | null {
  const tokens = text
    .split(/\s+/)
    .map((part) => normalizeToken(part))
    .filter(Boolean)
    .filter((token) => isValidToken(token, minLength))

  if (tokens.length === 0) return null
  return tokens[tokens.length - 1]
}

export function selectTargetWord(input: TargetWordInput): RhymeTarget | null {
  const minLength = input.minLength ?? DEFAULT_MIN_LENGTH
  const trimmed = input.text ?? ''
  const lineId = input.lineId
  const caretIndex = input.selection
    ? input.selection.start
    : input.caretIndex ?? trimmed.length

  if (input.selection && input.selection.start !== input.selection.end) {
    const selected = trimmed.slice(input.selection.start, input.selection.end)
    const normalized = normalizeToken(selected)
    if (isValidToken(normalized, minLength)) {
      return { word: selected, normalized, lineId, source: input.sourceHint ?? 'caret' }
    }
  }

  if (caretIndex != null) {
    const caretWord = extractWordAtCaret(trimmed, caretIndex, minLength)
    if (caretWord) {
      return { word: caretWord, normalized: caretWord, lineId, source: 'caret' }
    }
  }

  const typed = normalizeToken(input.lastTypedWord ?? '')
  if (typed && isValidToken(typed, minLength)) {
    return { word: typed, normalized: typed, lineId, source: 'lastTyped' }
  }

  const fallback = pickFallbackWord(trimmed, minLength)
  if (fallback) {
    return { word: fallback, normalized: fallback, lineId, source: input.sourceHint ?? 'lastTyped' }
  }

  return null
}

export function normalizeRhymeToken(token: string): string {
  return normalizeToken(token)
}
