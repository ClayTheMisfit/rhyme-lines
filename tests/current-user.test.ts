import { auth } from '@/auth'
import { getCurrentUser } from '@/lib/auth/current-user'

jest.mock('server-only', () => ({}))
jest.mock('@/auth', () => ({ auth: jest.fn() }))

const authMock = jest.mocked(auth)
const configuredEnvironment = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/rhyme_lines',
  AUTH_SECRET: 'a-secure-test-secret-that-is-long-enough',
  AUTH_GOOGLE_ID: 'google-test-id',
  AUTH_GOOGLE_SECRET: 'google-test-secret',
}

describe('getCurrentUser', () => {
  beforeEach(() => {
    Object.assign(process.env, configuredEnvironment)
    authMock.mockReset()
  })

  afterAll(() => {
    for (const key of Object.keys(configuredEnvironment)) delete process.env[key]
  })

  it('returns null for an anonymous session', async () => {
    authMock.mockResolvedValue(null)
    await expect(getCurrentUser()).resolves.toBeNull()
  })

  it('returns a stable allowlisted identity for an authenticated session', async () => {
    authMock.mockResolvedValue({
      expires: '2099-01-01T00:00:00.000Z',
      user: { id: 'user-123', name: 'Avery', email: 'avery@example.com', image: null },
    })
    await expect(getCurrentUser()).resolves.toEqual({
      id: 'user-123', name: 'Avery', email: 'avery@example.com', image: null,
    })
  })
})
