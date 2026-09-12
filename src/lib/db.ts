import 'server-only'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { getAuthEnvironment } from '@/lib/auth/environment'

const globalForDb = globalThis as unknown as { authDatabase?: PrismaClient }

export function getDatabase() {
  if (!globalForDb.authDatabase) {
    const { databaseUrl } = getAuthEnvironment()
    const adapter = new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 })
    globalForDb.authDatabase = new PrismaClient({ adapter })
  }
  return globalForDb.authDatabase
}
