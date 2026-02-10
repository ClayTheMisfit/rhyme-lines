const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF]/g

export function normalizePastedText(input: string): string {
  return input.replace(/\r\n?/g, '\n').replace(ZERO_WIDTH_CHARS, '')
}
