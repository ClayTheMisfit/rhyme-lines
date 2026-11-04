/** @jest-environment node */
jest.mock('server-only', () => ({}))
import { createOAuthConsentToken, OAUTH_CONSENT_MAX_AGE_SECONDS, verifyOAuthConsentToken } from '@/lib/auth/oauth-consent'

describe('OAuth registration consent', () => {
  const secret = 'a sufficiently long authentication secret'
  const now = Date.UTC(2026, 10, 3)

  it('accepts only a current token signed with the authentication secret', () => {
    const token = createOAuthConsentToken(secret, now)
    expect(verifyOAuthConsentToken(token, secret, now + 1_000)).toBe(true)
    expect(verifyOAuthConsentToken(token, 'a different sufficiently long secret', now + 1_000)).toBe(false)
  })

  it('rejects expired, future, and malformed tokens', () => {
    const token = createOAuthConsentToken(secret, now)
    expect(verifyOAuthConsentToken(token, secret, now + (OAUTH_CONSENT_MAX_AGE_SECONDS + 1) * 1_000)).toBe(false)
    expect(verifyOAuthConsentToken(createOAuthConsentToken(secret, now + 1_000), secret, now)).toBe(false)
    expect(verifyOAuthConsentToken('invalid', secret, now)).toBe(false)
  })
})
