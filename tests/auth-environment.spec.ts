/** @jest-environment node */

jest.mock('server-only', () => ({}))

import { AuthConfigurationError, getAuthEnvironment, isAuthCompletelyUnconfigured } from '@/lib/auth/environment'

const originalEnvironment = process.env

function configureCoreAuth() {
  process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/rhyme_lines'
  process.env.AUTH_SECRET = 'a-secure-test-secret-with-32-characters'
}

describe('authentication environment', () => {
  beforeEach(() => {
    process.env = { ...originalEnvironment }
    delete process.env.AUTH_GOOGLE_ID
    delete process.env.AUTH_GOOGLE_SECRET
    configureCoreAuth()
  })

  afterAll(() => {
    process.env = originalEnvironment
  })

  it('supports password-only authentication without Google credentials', () => {
    expect(getAuthEnvironment()).toMatchObject({
      databaseUrl: process.env.DATABASE_URL,
      secret: process.env.AUTH_SECRET,
      google: null,
    })
  })

  it('enables Google only when both credentials are configured', () => {
    process.env.AUTH_GOOGLE_ID = 'google-client-id'
    process.env.AUTH_GOOGLE_SECRET = 'google-client-secret'
    expect(getAuthEnvironment().google).toEqual({
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
    })
  })

  it.each(['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'] as const)('rejects a partial Google configuration missing %s', (missingKey) => {
    process.env.AUTH_GOOGLE_ID = 'google-client-id'
    process.env.AUTH_GOOGLE_SECRET = 'google-client-secret'
    delete process.env[missingKey]
    expect(() => getAuthEnvironment()).toThrow(new AuthConfigurationError('AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must be configured together'))
  })

  it('does not treat stray Google credentials as an entirely unconfigured checkout', () => {
    delete process.env.DATABASE_URL
    delete process.env.AUTH_SECRET
    process.env.AUTH_GOOGLE_ID = 'google-client-id'
    expect(isAuthCompletelyUnconfigured()).toBe(false)
  })
})
