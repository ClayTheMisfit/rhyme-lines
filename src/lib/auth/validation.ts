export const AUTH_PAYLOAD_LIMIT = 16 * 1024
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'confirmPassword' | 'token', string>>

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function validateEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = normalizeEmail(value)
  if (email.length < 3 || email.length > 254) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

export function validateName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim().replace(/\s+/g, ' ')
  return name.length >= 1 && name.length <= 80 ? name : null
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const length = Array.from(value).length
  if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) return null
  let bytes = 0
  for (const character of value) {
    const codePoint = character.codePointAt(0)!
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4
  }
  if (bytes > 512) return null
  return value
}

export function safeRedirectPath(value: unknown, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  try {
    const parsed = new URL(value, 'https://rhyme-lines.invalid')
    return parsed.origin === 'https://rhyme-lines.invalid' ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback
  } catch {
    return fallback
  }
}

export function validateSignupInput(input: unknown) {
  const body = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {}
  const name = validateName(body.name)
  const email = validateEmail(body.email)
  const errors: FieldErrors = {}
  if (!name) errors.name = 'Enter a name between 1 and 80 characters.'
  if (!email) errors.email = 'Enter a valid email address.'
  return Object.keys(errors).length ? { ok: false as const, errors } : { ok: true as const, value: { name: name!, email: email! } }
}

export function validatePasswordResetInput(input: unknown) {
  const body = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {}
  const token = typeof body.token === 'string' && body.token.length <= 256 ? body.token : null
  const password = validatePassword(body.password)
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''
  const errors: FieldErrors = {}
  if (!token) errors.token = 'This link is invalid.'
  if (!password) errors.password = `Use ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.`
  if (!password || password !== confirmPassword) errors.confirmPassword = 'Passwords must match.'
  return Object.keys(errors).length ? { ok: false as const, errors } : { ok: true as const, value: { token: token!, password: password! } }
}
