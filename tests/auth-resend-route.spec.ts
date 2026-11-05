/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('next/server', () => ({ after: jest.fn() }))
jest.mock('@/lib/auth/rate-limit', () => ({
  consumeAuthRateLimit: jest.fn(),
  getClientAddress: jest.fn(() => '192.0.2.4'),
}))
jest.mock('@/lib/auth/service', () => ({ requestPasswordReset: jest.fn(), resendVerificationEmail: jest.fn() }))
jest.mock('@/lib/auth/environment', () => ({ isRegistrationEnabled: jest.fn(() => true) }))

import { consumeAuthRateLimit } from '@/lib/auth/rate-limit'
import { requestPasswordReset, resendVerificationEmail } from '@/lib/auth/service'
import { after } from 'next/server'
import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route'
import { POST as resendVerification } from '@/app/api/auth/resend-verification/route'
import { isRegistrationEnabled } from '@/lib/auth/environment'

function request(path: string) {
  return new Request(`https://example.test/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://example.test' },
    body: JSON.stringify({ email: 'avery@example.com' }),
  })
}

describe('authentication recovery routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(isRegistrationEnabled).mockReturnValue(true)
  })

  it('does not issue or send verification links while registration is disabled', async () => {
    jest.mocked(isRegistrationEnabled).mockReturnValue(false)
    const response = await resendVerification(request('resend-verification'))
    expect(response.status).toBe(403)
    expect(consumeAuthRateLimit).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
    expect(resendVerificationEmail).not.toHaveBeenCalled()
  })

  it('rejects an IP-blocked verification resend before consuming its recipient limit', async () => {
    jest.mocked(consumeAuthRateLimit).mockResolvedValueOnce(false)
    const response = await resendVerification(request('resend-verification'))
    expect(response.status).toBe(202)
    expect(consumeAuthRateLimit).toHaveBeenCalledTimes(1)
    expect(consumeAuthRateLimit).toHaveBeenCalledWith('recovery-ip', '192.0.2.4')
    expect(after).not.toHaveBeenCalled()
    expect(resendVerificationEmail).not.toHaveBeenCalled()
  })

  it('applies an independent recipient limit to password recovery across addresses', async () => {
    jest.mocked(consumeAuthRateLimit).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const response = await forgotPassword(request('forgot-password'))
    expect(response.status).toBe(202)
    expect(consumeAuthRateLimit).toHaveBeenNthCalledWith(1, 'recovery-ip', '192.0.2.4')
    expect(consumeAuthRateLimit).toHaveBeenNthCalledWith(2, 'password-reset', 'avery@example.com')
    expect(after).not.toHaveBeenCalled()
    expect(requestPasswordReset).not.toHaveBeenCalled()
  })

  it.each([
    ['forgot-password', forgotPassword, requestPasswordReset],
    ['resend-verification', resendVerification, resendVerificationEmail],
  ] as const)('schedules eligible %s email after returning the generic response', async (path, route, deliver) => {
    jest.mocked(consumeAuthRateLimit).mockResolvedValue(true)
    const response = await route(request(path))
    expect(response.status).toBe(202)
    expect(deliver).not.toHaveBeenCalled()
    expect(after).toHaveBeenCalledTimes(1)

    const callback = jest.mocked(after).mock.calls[0][0]
    await callback()
    expect(deliver).toHaveBeenCalledWith('avery@example.com')
  })
})
