import { safeRedirectPath, validatePasswordResetInput, validateSignupInput } from '@/lib/auth/validation'

describe('auth validation', () => {
  it('normalizes signup email and accepts a long passphrase without arbitrary complexity rules', () => {
    const result = validateSignupInput({ name: '  Avery  Stone ', email: ' Avery@Example.COM ', password: 'a calm long passphrase', confirmPassword: 'a calm long passphrase' })
    expect(result).toEqual({ ok: true, value: { name: 'Avery Stone', email: 'avery@example.com', password: 'a calm long passphrase' } })
  })

  it('returns structured errors for invalid signup input', () => {
    const result = validateSignupInput({ name: '', email: 'not-email', password: 'short', confirmPassword: 'different' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toEqual(expect.objectContaining({ name: expect.any(String), email: expect.any(String), password: expect.any(String), confirmPassword: expect.any(String) }))
  })

  it('validates reset tokens and matching passwords', () => {
    expect(validatePasswordResetInput({ token: '', password: 'a calm long passphrase', confirmPassword: 'a calm long passphrase' }).ok).toBe(false)
    expect(validatePasswordResetInput({ token: 'token', password: 'a calm long passphrase', confirmPassword: 'a calm long passphrase' }).ok).toBe(true)
  })

  it.each(['https://evil.example', '//evil.example/path', '/\\evil.example', 'javascript:alert(1)'])('rejects unsafe redirect %s', (value) => {
    expect(safeRedirectPath(value)).toBe('/')
  })

  it('preserves a safe local redirect', () => {
    expect(safeRedirectPath('/dashboard?from=auth#top')).toBe('/dashboard?from=auth#top')
  })
})
