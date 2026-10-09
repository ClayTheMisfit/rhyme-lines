import 'server-only'
import type { Adapter, AdapterUser } from '@auth/core/adapters'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { getDatabase } from '@/lib/db'
import { normalizeEmail } from './validation'

type AuthDatabase = ReturnType<typeof getDatabase>

export function isVerifiedGoogleProfile(profile: unknown) {
  return typeof profile === 'object' && profile !== null && (profile as Record<string, unknown>).email_verified === true
}

export function createAuthAdapter(database: AuthDatabase): Adapter {
  const baseAdapter = PrismaAdapter(database)
  return {
    ...baseAdapter,
    async createUser(user) {
      const email = normalizeEmail(user.email)
      return database.$transaction(async (transaction) => {
        const pending = await transaction.user.findFirst({
          where: {
            email: { equals: email, mode: 'insensitive' },
            emailVerified: null,
            passwordSetupPending: true,
            credential: { is: null },
            accounts: { none: {} },
          },
          select: { id: true, name: true, image: true },
        })
        if (!pending) {
          return transaction.user.create({
            data: { name: user.name, email, emailVerified: user.emailVerified, image: user.image },
          }) as Promise<AdapterUser>
        }

        const now = new Date()
        const adopted = await transaction.user.update({
          where: { id: pending.id },
          data: {
            name: user.name ?? pending.name,
            email,
            emailVerified: now,
            image: user.image ?? pending.image,
            passwordSetupPending: false,
          },
        })
        await transaction.authToken.updateMany({
          where: { userId: pending.id, type: 'VERIFY_EMAIL', usedAt: null },
          data: { usedAt: now },
        })
        return { id: adopted.id, name: adopted.name, email, emailVerified: adopted.emailVerified, image: adopted.image }
      })
    },
    async getUserByEmail(email) {
      const user = await database.user.findFirst({
        where: { email: { equals: normalizeEmail(email), mode: 'insensitive' } },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          passwordSetupPending: true,
          credential: { select: { userId: true } },
          accounts: { select: { id: true }, take: 1 },
        },
      })
      if (!user?.email) return null
      if (user.passwordSetupPending && !user.emailVerified && !user.credential && user.accounts.length === 0) return null
      return { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, image: user.image }
    },
  }
}
