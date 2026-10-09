import 'server-only'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { getDatabase } from '@/lib/db'
import { createAuthAdapter, isVerifiedGoogleProfile } from '@/lib/auth/adapter'
import { getAuthEnvironment } from '@/lib/auth/environment'
import { authenticatePasswordCredentials } from '@/lib/auth/credentials'

// Lazy initialization keeps static builds and local writing database-independent.
export const { auth, handlers, signIn, signOut } = NextAuth(() => {
  const environment = getAuthEnvironment()
  const database = getDatabase()
  return {
    secret: environment.secret,
    adapter: createAuthAdapter(database),
    providers: [
      Google({
        clientId: environment.googleId,
        clientSecret: environment.googleSecret,
        allowDangerousEmailAccountLinking: false,
      }),
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
      signIn({ account, profile }) {
        return account?.provider !== 'google' || isVerifiedGoogleProfile(profile)
      },
      async jwt({ token, user }) {
        const userId = user?.id || token.sub
        if (!userId) return null
        const current = await database.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } })
        if (!current) return null
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
