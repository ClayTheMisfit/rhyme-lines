import 'server-only'

const required = ['DATABASE_URL', 'AUTH_SECRET', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'] as const

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthConfigurationError'
  }
}

export function getAuthEnvironment() {
  const missing = required.filter((key) => !process.env[key]?.trim())
  if (missing.length) {
    throw new AuthConfigurationError(`Authentication configuration missing: ${missing.join(', ')}`)
  }
  const databaseUrl = process.env.DATABASE_URL!
  let protocol: string
  try {
    protocol = new URL(databaseUrl).protocol
  } catch {
    throw new AuthConfigurationError('DATABASE_URL must be a PostgreSQL connection URL')
  }
  if (!['postgres:', 'postgresql:'].includes(protocol)) {
    throw new AuthConfigurationError('DATABASE_URL must be a PostgreSQL connection URL')
  }
  if (process.env.AUTH_SECRET!.length < 32) {
    throw new AuthConfigurationError('AUTH_SECRET must contain at least 32 characters')
  }
  return {
    databaseUrl,
    secret: process.env.AUTH_SECRET!,
    googleId: process.env.AUTH_GOOGLE_ID!,
    googleSecret: process.env.AUTH_GOOGLE_SECRET!,
  }
}

// An entirely unconfigured development checkout can still write locally.
// Partial configuration and every production auth request fail explicitly.
export function isLocalAnonymousMode() {
  return process.env.NODE_ENV !== 'production' && isAuthCompletelyUnconfigured()
}

export function isAuthCompletelyUnconfigured() {
  return required.every((key) => !process.env[key])
}
