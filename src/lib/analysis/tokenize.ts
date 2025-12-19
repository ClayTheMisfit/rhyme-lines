export type TokenizedWord = { start: number; end: number; text: string }

const WORD_REGEX = /[A-Za-z']+/g

export function tokenizeLine(text: string): TokenizedWord[] {
  const words: TokenizedWord[] = []
  let match: RegExpExecArray | null
  while ((match = WORD_REGEX.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    words.push({ start, end, text: match[0] })
  }
  return words
}
