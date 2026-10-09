/** @jest-environment node */
jest.mock('server-only', () => ({}))

const database = {
  authRateLimit: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  $transaction: jest.fn(),
}
jest.mock('@/lib/db', () => ({ getDatabase: () => database }))

import { consumeAuthRateLimit, getClientAddress } from '@/lib/auth/rate-limit'

describe('authentication rate limiter', () => {
  const originalVercel = process.env.VERCEL

  beforeAll(() => { process.env.AUTH_SECRET = 'test-auth-secret-that-is-at-least-32-characters' })
  afterEach(() => {
    if (originalVercel === undefined) delete process.env.VERCEL
    else process.env.VERCEL = originalVercel
  })

  it('ignores client-controlled forwarding headers outside a trusted platform boundary', () => {
    const request = new Request('https://example.test', {
      headers: {
        'x-vercel-forwarded-for': '192.0.2.1',
        'x-forwarded-for': '192.0.2.2',
        'x-real-ip': '192.0.2.3',
      },
    })
    expect(getClientAddress(request)).toBeNull()
  })

  it('fails closed in production when no trusted client-address source is configured', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      expect(() => getClientAddress(new Request('https://example.test'))).toThrow('trusted client-address source')
    } finally {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  it('uses the platform-owned client address on Vercel', () => {
    process.env.VERCEL = '1'
    const request = new Request('https://example.test', {
      headers: {
        'x-vercel-forwarded-for': '192.0.2.4, 198.51.100.7',
        'x-forwarded-for': '203.0.113.9',
      },
    })
    expect(getClientAddress(request)).toBe('192.0.2.4')
  })

  it('uses an explicitly configured trusted-proxy header outside Vercel', () => {
    process.env.AUTH_TRUSTED_PROXY_HEADER = 'x-real-ip'
    const request = new Request('https://example.test', { headers: { 'x-real-ip': '198.51.100.8' } })
    expect(getClientAddress(request)).toBe('198.51.100.8')
    delete process.env.AUTH_TRUSTED_PROXY_HEADER
  })

  it('retries a serializable write conflict without allowing the request through unchecked', async () => {
    const transaction = {
      authRateLimit: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      },
    }
    database.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce((callback) => callback(transaction))
    await expect(consumeAuthRateLimit('login', 'client-1', new Date('2026-09-27T12:00:00Z'))).resolves.toBe(true)
    expect(database.$transaction).toHaveBeenCalledTimes(2)
    expect(transaction.authRateLimit.upsert).toHaveBeenCalledTimes(1)
  })
})
