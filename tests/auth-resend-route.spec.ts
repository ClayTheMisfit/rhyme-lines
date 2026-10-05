/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('@/lib/auth/rate-limit', () => ({
  consumeAuthRateLimit: jest.fn(),
  getClientAddress: jest.fn(() => '192.0.2.4'),
}))
jest.mock('@/lib/auth/service', () => ({ resendVerificationEmail: jest.fn() }))

import { consumeAuthRateLimit } from '@/lib/auth/rate-limit'
import { resendVerificationEmail } from '@/lib/auth/service'
import { POST } from '@/app/api/auth/resend-verification/route'

describe('verification resend route', () => {
  it('applies identity and IP-wide limits before sending', async () => {
    jest.mocked(consumeAuthRateLimit).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const request = new Request('https://example.test/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://example.test' },
      body: JSON.stringify({ email: 'avery@example.com' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(202)
    expect(consumeAuthRateLimit).toHaveBeenNthCalledWith(1, 'recovery', '192.0.2.4:avery@example.com')
    expect(consumeAuthRateLimit).toHaveBeenNthCalledWith(2, 'recovery-ip', '192.0.2.4')
    expect(resendVerificationEmail).not.toHaveBeenCalled()
  })
})
