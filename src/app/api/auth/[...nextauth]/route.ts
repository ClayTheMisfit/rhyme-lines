import type { NextRequest } from 'next/server'
import { handlers } from '@/auth'
import { AuthConfigurationError } from '@/lib/auth/environment'

export const runtime = 'nodejs'

async function handle(request: NextRequest) {
  try {
    return await handlers[request.method === 'POST' ? 'POST' : 'GET'](request)
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) throw error
    console.error(error.message) // Names of missing variables only; never their values.
    return Response.json({ error: 'Authentication is not configured on this server.' }, { status: 503 })
  }
}

export { handle as GET, handle as POST }
