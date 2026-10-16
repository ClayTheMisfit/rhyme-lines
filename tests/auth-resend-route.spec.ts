/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('@/lib/auth/rate-limit', () => ({
  consumeAuthRateLimit: jest.fn(),
  getClientAddress: jest.fn(() => '192.0.2.4'),
}))
jest.mock('@/lib/auth/service', () => ({ requestPasswordReset: jest.fn(), resendVerificationEmail: jest.fn() }))

import { consumeAuthRateLimit } from '@/lib/auth/rate-limit'
import { requestPasswordReset, resendVerificationEmail } from '@/lib/auth/service'
import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route'
import { POST as resendVerification } from '@/app/api/auth/resend-verification/route'

function request(path: string) {
  return new Request(`https://example.test/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://example.test' },
    body: JSON.stringify({ email: 'avery@example.com' }),
  })
}

describe('authentication recovery routes', () => {
  beforeEach(() => jest.clearAllMocks())

  it('applies recipient and IP-wide limits before resending verification', async () => {
    jest.mocked(consumeAuthRateLimit).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const response = await resendVerification(request('resend-verification'))
    expect(response.status).toBe(202)
    expect(consumeAuthRateLimit).toHaveBeenNthCalledWith(1, 'recovery', 'avery@example.com')
    expect(consumeAuthRateLimit).toHaveBeenNthCalledWith(2, 'recovery-ip', '192.0.2.4')
    expect(resendVerificationEmail).not.toHaveBeenCalled()
  })

  it('applies the same recipient limit to password recovery across addresses', async () => {
    jest.mocked(consumeAuthRateLimit).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const response = await forgotPassword(request('forgot-password'))
    expect(response.status).toBe(202)
    expect(consumeAuthRateLimit).toHaveBeenNthCalledWith(1, 'recovery', 'avery@example.com')
    expect(consumeAuthRateLimit).toHaveBeenNthCalledWith(2, 'recovery-ip', '192.0.2.4')
    expect(requestPasswordReset).not.toHaveBeenCalled()
  })
})
