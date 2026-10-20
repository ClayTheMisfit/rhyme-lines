/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/auth/environment', () => ({ isLocalAnonymousMode: jest.fn() }))

import { auth } from '@/auth'
import { isLocalAnonymousMode } from '@/lib/auth/environment'
import { getCurrentUser } from '@/lib/auth/current-user'

const authMock = jest.mocked(auth)
const anonymousMock = jest.mocked(isLocalAnonymousMode)

describe('getCurrentUser', () => {
  beforeEach(() => { authMock.mockReset(); anonymousMock.mockReset() })

  it('returns null for anonymous local mode without touching Auth.js', async () => {
    anonymousMock.mockReturnValue(true)
    await expect(getCurrentUser()).resolves.toBeNull()
    expect(authMock).not.toHaveBeenCalled()
  })

  it('returns the allowlisted identity from an Auth.js session', async () => {
    anonymousMock.mockReturnValue(false)
    authMock.mockResolvedValue({ expires: new Date(Date.now() + 60_000).toISOString(), user: { id: 'user-1', name: 'Avery', email: 'avery@example.com', image: null } })
    await expect(getCurrentUser()).resolves.toEqual({ id: 'user-1', name: 'Avery', email: 'avery@example.com', image: null })
  })
})
