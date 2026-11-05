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
  isRegistrationEnabled: jest.fn(() => true),
}))

import { registerPasswordAccount } from '@/lib/auth/service'
import { after } from 'next/server'
import { POST } from '@/app/api/auth/signup/route'
import { getAuthEmailEnvironment, isRegistrationEnabled } from '@/lib/auth/environment'

function signupRequest() {
  return new Request('https://example.test/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://example.test' },
    body: JSON.stringify({ name: 'Avery', email: 'avery@example.com', acceptedTerms: true }),
  })
}

describe('signup route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(isRegistrationEnabled).mockReturnValue(true)
  })

  it('does not let existing email credentials enable registration without the release flag', async () => {
    jest.mocked(isRegistrationEnabled).mockReturnValue(false)
    const response = await POST(signupRequest())
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual(expect.objectContaining({ code: 'registration_disabled' }))
    expect(getAuthEmailEnvironment).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
    expect(registerPasswordAccount).not.toHaveBeenCalled()
  })

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

  it('rejects registration without explicit legal acknowledgement', async () => {
    const request = new Request('https://example.test/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://example.test' },
      body: JSON.stringify({ name: 'Avery', email: 'avery@example.com', acceptedTerms: false }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual(expect.objectContaining({
      ok: false,
      code: 'validation',
      fieldErrors: expect.objectContaining({ terms: expect.any(String) }),
    }))
    expect(after).not.toHaveBeenCalled()
  })
})
