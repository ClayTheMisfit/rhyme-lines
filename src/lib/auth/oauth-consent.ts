import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

export const OAUTH_CONSENT_COOKIE = 'rhyme-lines-oauth-consent'
export const OAUTH_CONSENT_MAX_AGE_SECONDS = 10 * 60
const consentPurpose = 'google-registration-terms:v1'

function signature(secret: string, issuedAt: string) {
  return createHmac('sha256', secret).update(`${consentPurpose}:${issuedAt}`).digest('base64url')
}

export function createOAuthConsentToken(secret: string, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000).toString()
  return `${issuedAt}.${signature(secret, issuedAt)}`
}

export function verifyOAuthConsentToken(token: string | undefined, secret: string, now = Date.now()) {
  if (!token) return false
  const [issuedAt, suppliedSignature, extra] = token.split('.')
  if (!issuedAt || !suppliedSignature || extra) return false
  const issuedAtSeconds = Number(issuedAt)
  const nowSeconds = Math.floor(now / 1000)
  if (!Number.isSafeInteger(issuedAtSeconds) || issuedAtSeconds > nowSeconds || nowSeconds - issuedAtSeconds > OAUTH_CONSENT_MAX_AGE_SECONDS) return false
  const expectedSignature = signature(secret, issuedAt)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
