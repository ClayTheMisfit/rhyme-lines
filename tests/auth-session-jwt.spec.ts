/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('next-auth/jwt', () => ({ decode: jest.fn(), encode: jest.fn() }))

import { decode } from 'next-auth/jwt'
import { createSessionJwt } from '@/lib/auth/session-jwt'

const decodeMock = jest.mocked(decode)
const params = { token: 'encrypted-token', secret: 'test-secret', salt: 'session-cookie' }

describe('session JWT validation', () => {
  beforeEach(() => decodeMock.mockReset())

  it('rejects a stale session before Auth.js can use it for OAuth linking', async () => {
    decodeMock.mockResolvedValue({ sub: 'user-1', sessionVersion: 2 })
    const database = { user: { findUnique: jest.fn().mockResolvedValue({ sessionVersion: 3 }) } }

    await expect(createSessionJwt(database as never).decode(params)).resolves.toBeNull()
  })

  it('accepts a session only when its stored version still matches', async () => {
    const token = { sub: 'user-1', sessionVersion: 3 }
    decodeMock.mockResolvedValue(token)
    const database = { user: { findUnique: jest.fn().mockResolvedValue({ sessionVersion: 3 }) } }

    await expect(createSessionJwt(database as never).decode(params)).resolves.toBe(token)
  })

  it('rejects legacy or malformed session tokens without a version claim', async () => {
    decodeMock.mockResolvedValue({ sub: 'user-1' })
    const database = { user: { findUnique: jest.fn() } }

    await expect(createSessionJwt(database as never).decode(params)).resolves.toBeNull()
    expect(database.user.findUnique).not.toHaveBeenCalled()
  })
})
