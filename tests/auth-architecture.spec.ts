/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('authentication architecture', () => {
  it('keeps Google and credentials on Auth.js with JWT sessions and strict email linking', () => {
    const source = read('src/auth.ts')
    expect(source).toContain('Google({')
    expect(source).toContain('Credentials({')
    expect(source).toContain("strategy: 'jwt'")
    expect(source).toContain('allowDangerousEmailAccountLinking: false')
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
