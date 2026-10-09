/** @jest-environment node */
jest.mock('server-only', () => ({}))

type MockDatabase = { $transaction?: jest.Mock; user?: { findFirst: jest.Mock; deleteMany?: jest.Mock }; [key: string]: unknown }
const mockDatabase: MockDatabase = {}
jest.mock('@/lib/db', () => ({ getDatabase: () => mockDatabase }))

import { registerPasswordAccount, requestPasswordReset, resendVerificationEmail, resetPasswordWithToken, verifyEmailToken } from '@/lib/auth/service'
import { verifyPassword } from '@/lib/auth/password'

describe('password account service', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockDatabase)) delete mockDatabase[key]
  })

  it('stores a pending password hash without creating an active credential', async () => {
    const sender = jest.fn().mockResolvedValue(undefined)
    const createUser = jest.fn().mockResolvedValue({ id: 'user-1' })
    const createToken = jest.fn().mockResolvedValue({ id: 'token-1' })
    const transaction = { user: { findFirst: jest.fn().mockResolvedValue(null), create: createUser }, authToken: { create: createToken } }
    mockDatabase.$transaction = jest.fn((callback) => callback(transaction))

    await expect(registerPasswordAccount({ name: 'Avery', email: 'avery@example.com', password: 'this is a secure passphrase' }, sender)).resolves.toEqual({ ok: true })
    const passwordHash = createUser.mock.calls[0][0].data.pendingPasswordHash
    expect(passwordHash).not.toContain('this is a secure passphrase')
    await expect(verifyPassword('this is a secure passphrase', passwordHash)).resolves.toBe(true)
    expect(createUser.mock.calls[0][0].data.credential).toBeUndefined()
    const stored = createToken.mock.calls[0][0].data.tokenHash
    const delivered = sender.mock.calls[0][0].token
    expect(stored).toMatch(/^[a-f0-9]{64}$/)
    expect(stored).not.toBe(delivered)
  })

  it('rejects an existing case-variant email without adding a password to the OAuth user', async () => {
    const sender = jest.fn()
    const createUser = jest.fn()
    const transaction = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'google-user' }), create: createUser }, authToken: { create: jest.fn() } }
    mockDatabase.$transaction = jest.fn((callback) => callback(transaction))
    await expect(registerPasswordAccount({ name: 'Avery', email: 'avery@example.com', password: 'this is a secure passphrase' }, sender)).resolves.toEqual({ ok: false, reason: 'duplicate' })
    expect(transaction.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { email: { equals: 'avery@example.com', mode: 'insensitive' } } }))
    expect(createUser).not.toHaveBeenCalled()
    expect(sender).not.toHaveBeenCalled()
  })

  it('handles a database uniqueness race as the same duplicate result', async () => {
    mockDatabase.$transaction = jest.fn().mockRejectedValue({ code: 'P2002' })
    await expect(registerPasswordAccount({ name: 'Avery', email: 'avery@example.com', password: 'this is a secure passphrase' }, jest.fn())).resolves.toEqual({ ok: false, reason: 'duplicate' })
  })

  it('retries a serializable signup conflict before reporting success', async () => {
    const sender = jest.fn().mockResolvedValue(undefined)
    const transaction = {
      user: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      authToken: { create: jest.fn().mockResolvedValue({ id: 'token-1' }) },
    }
    mockDatabase.$transaction = jest.fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce((callback) => callback(transaction))
    await expect(registerPasswordAccount({ name: 'Avery', email: 'avery@example.com', password: 'this is a secure passphrase' }, sender)).resolves.toEqual({ ok: true })
    expect(mockDatabase.$transaction).toHaveBeenCalledTimes(2)
  })

  it('removes an untouched pending registration when initial email delivery fails', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 })
    mockDatabase.user = { findFirst: jest.fn(), deleteMany }
    const transaction = {
      user: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      authToken: { create: jest.fn().mockResolvedValue({ id: 'token-1' }) },
    }
    mockDatabase.$transaction = jest.fn((callback) => callback(transaction))

    await expect(registerPasswordAccount(
      { name: 'Avery', email: 'avery@example.com', password: 'this is a secure passphrase' },
      jest.fn().mockRejectedValue(new Error('provider unavailable')),
    )).resolves.toEqual({ ok: false, reason: 'email' })

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
        emailVerified: null,
        pendingPasswordHash: expect.any(String),
        credential: { is: null },
        accounts: { none: {} },
      },
    })
  })

  it('resends verification for a pending registration without replacing its password hash', async () => {
    const sender = jest.fn().mockResolvedValue(undefined)
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 })
    const create = jest.fn().mockResolvedValue({ id: 'new-token' })
    mockDatabase.user = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'user-1', email: 'avery@example.com', emailVerified: null,
        pendingPasswordHash: 'pending-hash', credential: null,
      }),
    }
    mockDatabase.authToken = { deleteMany, create }
    mockDatabase.$transaction = jest.fn((operations) => Promise.all(operations))

    await resendVerificationEmail('avery@example.com', sender)

    expect(sender).toHaveBeenCalledTimes(1)
    expect(mockDatabase.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ pendingPasswordHash: true }),
    }))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-1', type: 'VERIFY_EMAIL' }),
    }))
  })

  it('consumes verification tokens once and rejects expiry and replay', async () => {
    const now = new Date('2026-09-26T12:00:00Z')
    const userUpdate = jest.fn()
    const credentialCreate = jest.fn()
    const makeDatabase = (record: Record<string, unknown> | null, claimed = 1) => {
      const transaction = { authToken: { findUnique: jest.fn().mockResolvedValue(record), updateMany: jest.fn().mockResolvedValue({ count: claimed }) }, credential: { create: credentialCreate }, user: { update: userUpdate } }
      mockDatabase.$transaction = jest.fn((callback) => callback(transaction))
    }
    makeDatabase({ id: 'token-1', userId: 'user-1', type: 'VERIFY_EMAIL', usedAt: null, expiresAt: new Date(now.getTime() + 1000), user: { emailVerified: null, pendingPasswordHash: 'pending-hash', credential: null } })
    await expect(verifyEmailToken('secret', now)).resolves.toBe(true)
    expect(credentialCreate).toHaveBeenCalledWith({ data: { userId: 'user-1', passwordHash: 'pending-hash' } })
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { emailVerified: now, pendingPasswordHash: null } })
    makeDatabase({ id: 'token-1', userId: 'user-1', type: 'VERIFY_EMAIL', usedAt: now, expiresAt: new Date(now.getTime() + 1000), user: { emailVerified: null, pendingPasswordHash: 'pending-hash', credential: null } })
    await expect(verifyEmailToken('secret', now)).resolves.toBe(false)
    makeDatabase({ id: 'token-1', userId: 'user-1', type: 'VERIFY_EMAIL', usedAt: null, expiresAt: new Date(now.getTime() - 1), user: { emailVerified: null, pendingPasswordHash: 'pending-hash', credential: null } })
    await expect(verifyEmailToken('secret', now)).resolves.toBe(false)
  })

  it('does not activate a verification token without a pending password', async () => {
    const now = new Date('2026-09-26T12:00:00Z')
    const transaction = {
      authToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'token-1', userId: 'user-1', type: 'VERIFY_EMAIL', usedAt: null,
          expiresAt: new Date(now.getTime() + 1000),
          user: { emailVerified: null, pendingPasswordHash: null, credential: null },
        }),
        updateMany: jest.fn(),
      },
      credential: { create: jest.fn() },
      user: { update: jest.fn() },
    }
    mockDatabase.$transaction = jest.fn((callback) => callback(transaction))
    await expect(verifyEmailToken('secret', now)).resolves.toBe(false)
    expect(transaction.credential.create).not.toHaveBeenCalled()
    expect(transaction.user.update).not.toHaveBeenCalled()
  })

  it('resets a password, invalidates reset tokens, and advances the session version', async () => {
    const now = new Date('2026-09-26T12:00:00Z')
    const credentialUpdate = jest.fn()
    const userUpdate = jest.fn()
    const invalidateTokens = jest.fn().mockResolvedValue({ count: 1 })
    const transaction = {
      authToken: {
        findUnique: jest.fn().mockResolvedValue({ id: 'token-1', userId: 'user-1', type: 'PASSWORD_RESET', usedAt: null, expiresAt: new Date(now.getTime() + 1000) }),
        updateMany: jest.fn().mockResolvedValueOnce({ count: 1 }).mockImplementation(invalidateTokens),
      },
      credential: { update: credentialUpdate },
      user: { update: userUpdate },
    }
    mockDatabase.$transaction = jest.fn((callback) => callback(transaction))
    await expect(resetPasswordWithToken('secret', 'another secure passphrase', now)).resolves.toBe(true)
    const hash = credentialUpdate.mock.calls[0][0].data.passwordHash
    expect(hash).not.toContain('another secure passphrase')
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { sessionVersion: { increment: 1 } } })
    expect(transaction.authToken.updateMany).toHaveBeenCalledTimes(2)
  })

  it('keeps unknown-email password recovery generic by sending nothing', async () => {
    const sender = jest.fn()
    mockDatabase.user = { findFirst: jest.fn().mockResolvedValue(null) }
    mockDatabase.authToken = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) }
    await expect(requestPasswordReset('unknown@example.com', sender)).resolves.toBeUndefined()
    expect(sender).not.toHaveBeenCalled()
  })

  it('cleans stale reset tokens without invalidating another live delivered link', async () => {
    const sender = jest.fn().mockResolvedValue(undefined)
    const deleteMany = jest.fn().mockResolvedValue({ count: 2 })
    const create = jest.fn().mockResolvedValue({ id: 'new-token' })
    mockDatabase.user = { findFirst: jest.fn().mockResolvedValue({ id: 'user-1', email: 'avery@example.com', emailVerified: new Date(), credential: { userId: 'user-1' } }) }
    mockDatabase.authToken = { deleteMany, create }
    mockDatabase.$transaction = jest.fn((operations) => Promise.all(operations))
    await requestPasswordReset('avery@example.com', sender)
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        type: 'PASSWORD_RESET',
        OR: [{ usedAt: { not: null } }, { expiresAt: { lte: expect.any(Date) } }],
      },
    })
    expect(sender).toHaveBeenCalledTimes(1)
  })
})
