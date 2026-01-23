const TRIM_NON_LETTERS_REGEX = /^[^a-z']+|[^a-z']+$/g

export const normalizeToken = (raw: string) => {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) {
    return ''
  }
  return trimmed.replace(TRIM_NON_LETTERS_REGEX, '')
}
