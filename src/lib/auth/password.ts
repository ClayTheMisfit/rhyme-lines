import 'server-only'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto'

const KEY_LENGTH = 64
const OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const DUMMY_SALT = 'f4c7a51bb8ce35dca2e86f1cb529361c'
let dummyHashPromise: Promise<string> | undefined

function derive(password: string, salt: string, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, options, (error, key) => error ? reject(error) : resolve(key as Buffer))
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = await derive(password, salt, OPTIONS)
  return `scrypt$${OPTIONS.N}$${OPTIONS.r}$${OPTIONS.p}$${salt}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, n, r, p, salt, expectedHex] = storedHash.split('$')
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false
  const expected = Buffer.from(expectedHex, 'hex')
  if (expected.length !== KEY_LENGTH) return false
  try {
    const actual = await derive(password, salt, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    })
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export async function getDummyPasswordHash() {
  dummyHashPromise ??= (async () => {
    const derived = await derive('not-a-real-password', DUMMY_SALT, OPTIONS)
    return `scrypt$${OPTIONS.N}$${OPTIONS.r}$${OPTIONS.p}$${DUMMY_SALT}$${derived.toString('hex')}`
  })()
  return dummyHashPromise
}
