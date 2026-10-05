import 'server-only'
import { getDatabase } from '@/lib/db'
import { clearAuthRateLimit, consumeAuthRateLimit, getClientAddress } from './rate-limit'
import { getDummyPasswordHash, verifyPassword } from './password'
import { validateEmail, validatePassword } from './validation'

type CredentialUser = {
  id: string
  name: string | null
  email: string | null
  image: string | null
  emailVerified: Date | null
  sessionVersion: number
  credential: { passwordHash: string } | null
}

type CredentialDependencies = {
  findUser(email: string): Promise<CredentialUser | null>
  consume(action: 'login' | 'login-ip', identity: string): Promise<boolean>
  clear(action: 'login', identity: string): Promise<void>
  verify(password: string, hash: string): Promise<boolean>
  dummyHash(): Promise<string>
}

const productionDependencies: CredentialDependencies = {
  findUser(email) {
    return getDatabase().user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        id: true, name: true, email: true, image: true, emailVerified: true, sessionVersion: true,
        credential: { select: { passwordHash: true } },
      },
    })
  },
  consume: consumeAuthRateLimit,
  clear: clearAuthRateLimit,
  verify: verifyPassword,
  dummyHash: getDummyPasswordHash,
}

export async function authenticatePasswordCredentials(
  credentials: Partial<Record<'email' | 'password', unknown>>,
  request: Request,
  dependencies: CredentialDependencies = productionDependencies,
) {
  const email = validateEmail(credentials.email)
  const password = validatePassword(credentials.password)
  const address = getClientAddress(request)
  const identity = `${address}:${email || 'invalid'}`
  const [identityAllowed, addressAllowed] = await Promise.all([
    dependencies.consume('login', identity),
    dependencies.consume('login-ip', address),
  ])
  if (!identityAllowed || !addressAllowed || !email || !password) {
    if (password) await dependencies.verify(password, await dependencies.dummyHash())
    return null
  }
  const user = await dependencies.findUser(email)
  const passwordHash = user?.credential?.passwordHash || await dependencies.dummyHash()
  const valid = await dependencies.verify(password, passwordHash)
  if (!user || !user.credential || !user.emailVerified || !valid) return null
  await dependencies.clear('login', identity)
  return { id: user.id, name: user.name, email: user.email, image: user.image, sessionVersion: user.sessionVersion }
}
