/** @jest-environment node */
jest.mock('server-only', () => ({}))

const database = {
  authRateLimit: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  $transaction: jest.fn(),
}
jest.mock('@/lib/db', () => ({ getDatabase: () => database }))

import { consumeAuthRateLimit } from '@/lib/auth/rate-limit'

describe('authentication rate limiter', () => {
  beforeAll(() => { process.env.AUTH_SECRET = 'test-auth-secret-that-is-at-least-32-characters' })

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
