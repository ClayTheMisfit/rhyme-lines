/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('authentication architecture', () => {
  it('keeps optional Google and required credentials on Auth.js with JWT sessions and strict email linking', () => {
    const source = read('src/auth.ts')
    expect(source).toContain('Google({')
    expect(source).toContain('...(environment.google ? [Google({')
    expect(source).toContain('Credentials({')
    expect(source).toContain("strategy: 'jwt'")
    expect(source).toContain('allowDangerousEmailAccountLinking: false')
    expect(source).toContain('isVerifiedGoogleProfile(profile)')
    expect(source).toContain('verifyOAuthConsentToken')
    expect(source).toContain('!isUnclaimedPendingRegistration(existing)')
    expect(source).toContain("if (!isRegistrationEnabled()) return '/signin?error=RegistrationDisabled'")
    expect(source.indexOf('!isUnclaimedPendingRegistration(existing)')).toBeLessThan(source.indexOf('if (!isRegistrationEnabled())'))
    expect(source).toContain("authenticatedVersion !== current.sessionVersion")
    expect(source).toContain('jwt: createSessionJwt(database)')
  })

  it('enforces the registration gate on every server-side account activation path', () => {
    for (const file of [
      'src/app/api/auth/signup/route.ts',
      'src/app/api/auth/oauth-consent/route.ts',
      'src/app/api/auth/resend-verification/route.ts',
      'src/app/api/auth/verify-email/route.ts',
    ]) expect(read(file)).toContain('if (!isRegistrationEnabled())')
  })

  it('keeps downstream identity behind getCurrentUser', () => {
    expect(read('src/lib/auth/current-user.ts')).toContain('const session = await auth()')
    expect(read('src/app/api/account/route.ts')).toContain('getCurrentUser()')
  })

  it('adds forward-only credential, token, rate-limit, and case-insensitive uniqueness storage', () => {
    const migration = read('prisma/migrations/20260926000000_password_auth/migration.sql')
    expect(migration).toContain('CREATE TABLE "Credential"')
    expect(migration).toContain('CREATE TABLE "AuthToken"')
    expect(migration).toContain('CREATE TABLE "AuthRateLimit"')
    expect(migration).toContain('LOWER("email")')
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE/)
  })
})
