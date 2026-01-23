const TRIM_NON_LETTERS_REGEX = /^[^a-z']+|[^a-z']+$/g
const EDGE_APOSTROPHE_REGEX = /^'+|'+$/g

export const normalizeToken = (raw: string) => {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) {
    return ''
  }
  const stripped = trimmed.replace(TRIM_NON_LETTERS_REGEX, '')
  return stripped.replace(EDGE_APOSTROPHE_REGEX, '')
}
