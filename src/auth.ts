import 'server-only'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { cookies } from 'next/headers'
import { getDatabase } from '@/lib/db'
import { createAuthAdapter, isUnclaimedPendingRegistration, isVerifiedGoogleProfile } from '@/lib/auth/adapter'
import { getAuthEnvironment, isRegistrationEnabled } from '@/lib/auth/environment'
import { authenticatePasswordCredentials } from '@/lib/auth/credentials'
import { OAUTH_CONSENT_COOKIE, verifyOAuthConsentToken } from '@/lib/auth/oauth-consent'
import { createSessionJwt } from '@/lib/auth/session-jwt'
import { normalizeEmail } from '@/lib/auth/validation'

// Lazy initialization keeps static builds and local writing database-independent.
export const { auth, handlers, signIn, signOut } = NextAuth(() => {
  const environment = getAuthEnvironment()
  const database = getDatabase()
  return {
    secret: environment.secret,
    adapter: createAuthAdapter(database),
    jwt: createSessionJwt(database),
    providers: [
      ...(environment.google ? [Google({
        clientId: environment.google.clientId,
        clientSecret: environment.google.clientSecret,
        allowDangerousEmailAccountLinking: false,
      })] : []),
      Credentials({
        credentials: {
          email: { label: 'Email', type: 'email', autocomplete: 'email' },
          password: { label: 'Password', type: 'password', autocomplete: 'current-password' },
        },
        async authorize(credentials, request) {
          return authenticatePasswordCredentials(credentials, request)
        },
      }),
    ],
    session: { strategy: 'jwt' },
    pages: { signIn: '/signin', error: '/signin' },
    callbacks: {
      async signIn({ account, profile }) {
        if (account?.provider !== 'google') return true
        if (!isVerifiedGoogleProfile(profile)) return false
        const email = typeof profile?.email === 'string' ? normalizeEmail(profile.email) : ''
        if (!email) return false
        const existing = await database.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: {
            emailVerified: true,
            passwordSetupPending: true,
            credential: { select: { userId: true } },
            accounts: { select: { id: true }, take: 1 },
          },
        })
        if (existing && !isUnclaimedPendingRegistration(existing)) return true
        if (!isRegistrationEnabled()) return '/signin?error=RegistrationDisabled'
        const cookieStore = await cookies()
        return verifyOAuthConsentToken(cookieStore.get(OAUTH_CONSENT_COOKIE)?.value, environment.secret)
          || '/signin?error=GoogleTermsRequired'
      },
      async jwt({ token, user }) {
        const userId = user?.id || token.sub
        if (!userId) return null
        const current = await database.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } })
        if (!current) return null
        const authenticatedVersion = (user as { sessionVersion?: unknown } | undefined)?.sessionVersion
        if (typeof authenticatedVersion === 'number' && authenticatedVersion !== current.sessionVersion) return null
        if (token.sessionVersion !== undefined && token.sessionVersion !== current.sessionVersion) return null
        token.sub = userId
        token.sessionVersion = current.sessionVersion
        return token
      },
      session({ session, token }) {
        if (!token.sub) return { ...session, user: undefined }
        return {
          expires: session.expires,
          user: { id: token.sub, name: session.user?.name, email: session.user?.email, image: session.user?.image },
        }
      },
    },
    // Auth.js errors may contain provider/adapter details. Log only the error kind.
    logger: { error(error) { console.error('[auth]', error.name) } },
  }
})
