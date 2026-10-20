/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('next/server', () => ({ after: jest.fn() }))
jest.mock('@/lib/auth/rate-limit', () => ({
  consumeAuthRateLimit: jest.fn(),
  getClientAddress: jest.fn(() => null),
}))
jest.mock('@/lib/auth/service', () => ({ registerPasswordAccount: jest.fn() }))
jest.mock('@/lib/auth/environment', () => ({
  AuthConfigurationError: class AuthConfigurationError extends Error {},
  getAuthEmailEnvironment: jest.fn(() => ({ from: 'test@example.com', apiKey: 'test' })),
}))

import { registerPasswordAccount } from '@/lib/auth/service'
import { after } from 'next/server'
import { POST } from '@/app/api/auth/signup/route'

function signupRequest() {
  return new Request('https://example.test/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://example.test' },
    body: JSON.stringify({ name: 'Avery', email: 'avery@example.com' }),
  })
}

describe('signup route', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns the same response for new and duplicate email addresses', async () => {
    jest.mocked(registerPasswordAccount)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, reason: 'duplicate' })

    const accepted = await POST(signupRequest())
    const duplicate = await POST(signupRequest())

    expect(registerPasswordAccount).not.toHaveBeenCalled()
    expect(duplicate.status).toBe(accepted.status)
    expect(await duplicate.json()).toEqual(await accepted.json())
    expect(accepted.status).toBe(201)
    expect(after).toHaveBeenCalledTimes(2)

    await jest.mocked(after).mock.calls[0][0]()
    await jest.mocked(after).mock.calls[1][0]()
    expect(registerPasswordAccount).toHaveBeenCalledTimes(2)
  })
})
