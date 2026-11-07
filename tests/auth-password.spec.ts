/** @jest-environment node */
jest.mock('server-only', () => ({}))

import { hashPassword, verifyPassword } from '@/lib/auth/password'

describe('password hashing', () => {
  it('stores a salted scrypt hash rather than plaintext and verifies it', async () => {
    const password = 'this is a secure passphrase'
    const hash = await hashPassword(password)
    expect(hash).toMatch(/^scrypt\$/)
    expect(hash).not.toContain(password)
    await expect(verifyPassword(password, hash)).resolves.toBe(true)
    await expect(verifyPassword('wrong password entirely', hash)).resolves.toBe(false)
  })

  it('uses a different salt for the same password', async () => {
    const [first, second] = await Promise.all([hashPassword('this is a secure passphrase'), hashPassword('this is a secure passphrase')])
    expect(first).not.toBe(second)
  })
})
