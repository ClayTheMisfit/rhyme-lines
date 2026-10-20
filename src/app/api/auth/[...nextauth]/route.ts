import { NextRequest } from 'next/server'
import { handlers } from '@/auth'
import { AuthConfigurationError } from '@/lib/auth/environment'
import { AuthRequestError, readBodyWithinLimit } from '@/lib/auth/request'

export const runtime = 'nodejs'

async function handle(request: NextRequest) {
  try {
    const length = Number(request.headers.get('content-length') || '0')
    if (Number.isFinite(length) && length > 64 * 1024) {
      return Response.json({ error: 'Request is too large.' }, { status: 413 })
    }
    if (request.method === 'POST') {
      const body = await readBodyWithinLimit(request, 64 * 1024)
      const boundedRequest = new NextRequest(request.url, { method: 'POST', headers: request.headers, body })
      return await handlers.POST(boundedRequest)
    }
    return await handlers.GET(request)
  } catch (error) {
    if (error instanceof AuthRequestError) return Response.json({ error: error.message }, { status: error.status })
    if (!(error instanceof AuthConfigurationError)) throw error
    console.error(error.message) // Names of missing variables only; never their values.
    return Response.json({ error: 'Authentication is not configured on this server.' }, { status: 503 })
  }
}

export { handle as GET, handle as POST }
