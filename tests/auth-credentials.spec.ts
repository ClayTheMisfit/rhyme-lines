/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('@/lib/db', () => ({ getDatabase: jest.fn() }))

import { authenticatePasswordCredentials } from '@/lib/auth/credentials'

const request = new Request('https://example.test/api/auth/callback/credentials', { headers: { 'x-forwarded-for': '192.0.2.4' } })
const password = 'this is a secure passphrase'
const baseUser = { id: 'user-1', name: 'Avery', email: 'avery@example.com', image: null, emailVerified: new Date(), sessionVersion: 0, credential: { passwordHash: 'stored' } }

function dependencies(user: typeof baseUser | null, valid: boolean) {
  return {
    findUser: jest.fn().mockResolvedValue(user),
    consume: jest.fn().mockResolvedValue(true),
    clear: jest.fn().mockResolvedValue(undefined),
    verify: jest.fn().mockResolvedValue(valid),
    dummyHash: jest.fn().mockResolvedValue('dummy'),
  }
}

describe('credentials authentication', () => {
  it('returns the database user for valid verified credentials', async () => {
    const deps = dependencies(baseUser, true)
    await expect(authenticatePasswordCredentials({ email: ' AVERY@EXAMPLE.COM ', password }, request, deps)).resolves.toEqual(expect.objectContaining({ id: 'user-1', sessionVersion: 0 }))
    expect(deps.findUser).toHaveBeenCalledWith('avery@example.com')
  })

  it('returns the same public null result for a wrong password and an unknown email', async () => {
    await expect(authenticatePasswordCredentials({ email: 'avery@example.com', password }, request, dependencies(baseUser, false))).resolves.toBeNull()
    const unknown = dependencies(null, false)
    await expect(authenticatePasswordCredentials({ email: 'unknown@example.com', password }, request, unknown)).resolves.toBeNull()
    expect(unknown.verify).toHaveBeenCalledWith(password, 'dummy')
  })

  it('does not authenticate an unverified account', async () => {
    await expect(authenticatePasswordCredentials({ email: 'avery@example.com', password }, request, dependencies({ ...baseUser, emailVerified: null }, true))).resolves.toBeNull()
  })

  it('returns null when rate limited', async () => {
    const deps = dependencies(baseUser, true)
    deps.consume.mockResolvedValueOnce(false)
    await expect(authenticatePasswordCredentials({ email: 'avery@example.com', password }, request, deps)).resolves.toBeNull()
    expect(deps.findUser).not.toHaveBeenCalled()
  })
})
