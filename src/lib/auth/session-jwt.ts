import 'server-only'
import { decode, encode, type JWTDecodeParams } from 'next-auth/jwt'
import { getDatabase } from '@/lib/db'

type AuthDatabase = ReturnType<typeof getDatabase>

export function createSessionJwt(database: AuthDatabase) {
  return {
    encode,
    async decode(params: JWTDecodeParams) {
      const token = await decode(params)
      if (!token?.sub || typeof token.sessionVersion !== 'number') return null
      const current = await database.user.findUnique({
        where: { id: token.sub },
        select: { sessionVersion: true },
      })
      return current?.sessionVersion === token.sessionVersion ? token : null
    },
  }
}
