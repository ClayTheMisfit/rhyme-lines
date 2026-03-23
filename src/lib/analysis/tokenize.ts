export type TokenizedWord = {
  start: number
  end: number
  text: string
  kind: 'word' | 'meridiem' | 'time'
  analysisKey?: string
}

const WORD_REGEX = /[A-Za-z][A-Za-z'’‘]*|\d+/y
const MERIDIEM_REGEX = /^(\d{1,2})(\s*)(a\.?\s*m\.?|p\.?\s*m\.?)/i
const TIME_REGEX = /^(\d{1,2}):([0-5]\d)/

export function isWordLikeToken(token: string | TokenizedWord): boolean {
  if (typeof token === 'string') {
    return /^[A-Za-z][A-Za-z'’‘]*$/.test(token) || /^\d+$/.test(token)
  }

  if (token.kind === 'meridiem') return true
  if (token.kind === 'time') return true

  const candidate = token.analysisKey ?? token.text
  return /^[A-Za-z][A-Za-z'’‘]*$/.test(candidate) || /^\d+$/.test(candidate)
}

export function tokenizeLine(text: string): TokenizedWord[] {
  const words: TokenizedWord[] = []
  let index = 0

  while (index < text.length) {
    const groupedTime = matchStandaloneTimeToken(text, index)
    if (groupedTime) {
      words.push(groupedTime)
      index = groupedTime.end
      continue
    }

    const groupedMeridiem = matchStandaloneMeridiemToken(text, index)
    if (groupedMeridiem) {
      words.push(groupedMeridiem)
      index = groupedMeridiem.end
      continue
    }

    WORD_REGEX.lastIndex = index
    const match = WORD_REGEX.exec(text)
    if (match) {
      const start = match.index
      const end = start + match[0].length
      words.push({ start, end, text: match[0], kind: 'word' })
      index = end
      continue
    }

    index += 1
  }

  return words
}

function matchStandaloneTimeToken(text: string, index: number): TokenizedWord | null {
  const char = text[index]
  if (!char || char < '0' || char > '9') return null
  if (index > 0 && (text[index - 1] === ':' || /[A-Za-z0-9]/.test(text[index - 1]))) return null

  const match = TIME_REGEX.exec(text.slice(index))
  if (!match) return null

  const hour = Number.parseInt(match[1], 10)
  if (!Number.isFinite(hour) || hour < 1 || hour > 12) return null

  const fullToken = match[0]
  const tokenEnd = index + fullToken.length
  if (tokenEnd < text.length && (text[tokenEnd] === ':' || /[A-Za-z0-9]/.test(text[tokenEnd]))) return null

  return {
    start: index,
    end: tokenEnd,
    text: fullToken,
    kind: 'time',
  }
}

function matchStandaloneMeridiemToken(text: string, index: number): TokenizedWord | null {
  const char = text[index]
  if (!char || char < '0' || char > '9') return null
  if (index > 0 && /[A-Za-z0-9]/.test(text[index - 1])) return null

  const match = MERIDIEM_REGEX.exec(text.slice(index))
  if (!match) return null

  const hour = Number.parseInt(match[1], 10)
  if (!Number.isFinite(hour) || hour < 1 || hour > 12) return null

  const fullToken = match[0]
  const tokenEnd = index + fullToken.length
  if (tokenEnd < text.length && /[A-Za-z0-9]/.test(text[tokenEnd])) return null

  return {
    start: index,
    end: tokenEnd,
    text: fullToken,
    kind: 'meridiem',
    analysisKey: normalizeMeridiemKey(fullToken),
  }
}

function normalizeMeridiemKey(token: string): string {
  return token.toLowerCase().replace(/[.\s]/g, '')
}
