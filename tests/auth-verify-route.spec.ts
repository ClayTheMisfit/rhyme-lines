/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('@/lib/auth/environment', () => ({ isRegistrationEnabled: jest.fn(() => false) }))
jest.mock('@/lib/auth/rate-limit', () => ({
  consumeAuthRateLimit: jest.fn(),
  getClientAddress: jest.fn(),
}))
jest.mock('@/lib/auth/service', () => ({ verifyEmailToken: jest.fn() }))

import { consumeAuthRateLimit } from '@/lib/auth/rate-limit'
import { verifyEmailToken } from '@/lib/auth/service'
import { POST } from '@/app/api/auth/verify-email/route'

describe('email verification registration gate', () => {
  it('does not activate a pending account while registration is disabled', async () => {
    const response = await POST(new Request('https://example.test/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://example.test' },
      body: JSON.stringify({ token: 'pending-registration-token', password: 'a long owner chosen passphrase' }),
    }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual(expect.objectContaining({ code: 'registration_disabled' }))
    expect(consumeAuthRateLimit).not.toHaveBeenCalled()
    expect(verifyEmailToken).not.toHaveBeenCalled()
  })
})
