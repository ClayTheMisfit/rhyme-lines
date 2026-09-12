import 'server-only'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { getDatabase } from '@/lib/db'
import { getAuthEnvironment } from '@/lib/auth/environment'

// Lazy initialization keeps static builds and local writing database-independent.
export const { auth, handlers, signIn, signOut } = NextAuth(() => {
  const environment = getAuthEnvironment()
  return {
    secret: environment.secret,
    adapter: PrismaAdapter(getDatabase()),
    providers: [Google({ clientId: environment.googleId, clientSecret: environment.googleSecret })],
    session: { strategy: 'database' },
    pages: { signIn: '/signin', error: '/signin' },
    callbacks: {
      session({ session, user }) {
        // Build an allowlist: the adapter's session object contains sessionToken.
        return {
          expires: session.expires,
          user: { id: user.id, name: user.name, email: user.email, image: user.image },
        }
      },
    },
    // Auth.js errors may contain provider/adapter details. Log only the error kind.
    logger: { error(error) { console.error('[auth]', error.name) } },
  }
})
