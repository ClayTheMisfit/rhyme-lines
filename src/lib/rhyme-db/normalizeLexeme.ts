const CMU_ALT_SUFFIX = /\(\d+\)$/i

export function normalizeLexeme(raw: string): string {
  let s = raw.trim().toLowerCase()
  if (!s) return ''

  s = s.replace(CMU_ALT_SUFFIX, '')
  s = s.replace(/^[^a-z']+|[^a-z']+$/g, '')

  if (!/^[a-z]+(?:'[a-z]+)*$/.test(s)) return ''
  if (s.length < 2) return ''
  if (!/[aeiouy]/.test(s)) return ''

  return s
}

export { CMU_ALT_SUFFIX }
