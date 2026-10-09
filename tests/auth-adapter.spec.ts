/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }))

import { createAuthAdapter, isVerifiedGoogleProfile } from '@/lib/auth/adapter'

const pendingUser = {
  id: 'pending-user',
  name: 'Pending Name',
  email: 'owner@example.com',
  emailVerified: null,
  image: null,
  passwordSetupPending: true,
  credential: null,
  accounts: [],
}

describe('authentication adapter', () => {
  it('requires Google to report a verified email before OAuth can continue', () => {
    expect(isVerifiedGoogleProfile({ email_verified: true })).toBe(true)
    expect(isVerifiedGoogleProfile({ email_verified: false })).toBe(false)
    expect(isVerifiedGoogleProfile(undefined)).toBe(false)
  })

  it('hides an unclaimed pending signup from the OAuth email collision check', async () => {
    const database = { user: { findFirst: jest.fn().mockResolvedValue(pendingUser) } }
    const adapter = createAuthAdapter(database as never)

    await expect(adapter.getUserByEmail!(' OWNER@EXAMPLE.COM ')).resolves.toBeNull()
    expect(database.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: { equals: 'owner@example.com', mode: 'insensitive' } },
    }))
  })

  it('keeps established accounts visible to strict Auth.js email linking checks', async () => {
    const establishedUser = { ...pendingUser, passwordSetupPending: false, accounts: [{ id: 'google-account' }] }
    const database = { user: { findFirst: jest.fn().mockResolvedValue(establishedUser) } }
    const adapter = createAuthAdapter(database as never)

    await expect(adapter.getUserByEmail!('owner@example.com')).resolves.toEqual(expect.objectContaining({ id: pendingUser.id }))
  })

  it('atomically adopts a pending signup and invalidates its verification links', async () => {
    const adopted = { ...pendingUser, name: 'Google Owner', emailVerified: new Date(), passwordSetupPending: false }
    const transaction = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: pendingUser.id, name: pendingUser.name, image: pendingUser.image }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(adopted),
      },
      authToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    }
    const database = {
      $transaction: jest.fn((operation) => operation(transaction)),
    }
    const adapter = createAuthAdapter(database as never)

    await expect(adapter.createUser!({
      id: 'ignored-provider-id',
      name: 'Google Owner',
      email: ' OWNER@EXAMPLE.COM ',
      emailVerified: null,
      image: 'https://example.test/avatar.png',
    })).resolves.toEqual(expect.objectContaining({ id: pendingUser.id, email: 'owner@example.com' }))

    expect(transaction.user.create).not.toHaveBeenCalled()
    expect(transaction.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: pendingUser.id },
      data: expect.objectContaining({
        email: 'owner@example.com',
        emailVerified: expect.any(Date),
        passwordSetupPending: false,
      }),
    }))
    expect(transaction.authToken.updateMany).toHaveBeenCalledWith({
      where: { userId: pendingUser.id, type: 'VERIFY_EMAIL', usedAt: null },
      data: { usedAt: expect.any(Date) },
    })
  })
})
