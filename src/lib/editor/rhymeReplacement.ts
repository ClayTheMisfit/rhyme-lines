import { normalizeToken } from '@/lib/rhyme-db/normalizeToken'
import { tokenizePlainText } from '@/lib/editor/plainText'

export type RhymeTargetRange = {
  start: number
  end: number
  normalizedWord: string
}

export function resolveRhymeTarget(text: string, caretIndex: number): RhymeTargetRange | null {
  const caret = Math.max(0, Math.min(caretIndex, text.length))
  const tokens = tokenizePlainText(text)
  const token =
    tokens.find(({ start, end }) => caret >= start && caret <= end) ??
    [...tokens].reverse().find(({ end }) => end <= caret)
  if (!token) return null
  const normalizedWord = normalizeToken(token.word)
  return normalizedWord ? { start: token.start, end: token.end, normalizedWord } : null
}

export function preserveWordCase(source: string, replacement: string): string {
  if (source === source.toUpperCase() && source !== source.toLowerCase()) return replacement.toUpperCase()
  if (/^\p{Lu}/u.test(source)) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase()
  }
  return replacement.toLowerCase()
}

export function applyRhymeReplacement(
  text: string,
  target: RhymeTargetRange,
  replacement: string
): { text: string; caretIndex: number } | null {
  const current = text.slice(target.start, target.end)
  if (normalizeToken(current) !== target.normalizedWord) return null
  const inserted = preserveWordCase(current, replacement)
  return {
    text: `${text.slice(0, target.start)}${inserted}${text.slice(target.end)}`,
    caretIndex: target.start + inserted.length,
  }
}
