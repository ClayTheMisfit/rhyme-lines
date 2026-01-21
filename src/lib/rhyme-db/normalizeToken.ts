const PUNCTUATION_REGEX = /^[.,!?;:"“”‘’'()\\[\\]{}<>]+|[.,!?;:"“”‘’'()\\[\\]{}<>]+$/g

export const normalizeToken = (raw: string) => {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) {
    return ''
  }
  return trimmed.replace(PUNCTUATION_REGEX, '')
}
