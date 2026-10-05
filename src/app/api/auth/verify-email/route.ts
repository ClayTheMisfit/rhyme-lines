import { readAuthJson, AuthRequestError } from '@/lib/auth/request'
import { consumeAuthRateLimit, getClientAddress } from '@/lib/auth/rate-limit'
import { verifyEmailToken } from '@/lib/auth/service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await readAuthJson(request) as Record<string, unknown>
    const token = typeof body?.token === 'string' && body.token.length <= 256 ? body.token : null
    if (!token) return Response.json({ ok: false, code: 'invalid_token', message: 'This verification link is invalid or expired.' }, { status: 400 })
    if (!await consumeAuthRateLimit('token', getClientAddress(request))) {
      return Response.json({ ok: false, code: 'rate_limited', message: 'Too many attempts. Please try again later.' }, { status: 429 })
    }
    const verified = await verifyEmailToken(token)
    return verified
      ? Response.json({ ok: true })
      : Response.json({ ok: false, code: 'invalid_token', message: 'This verification link is invalid, expired, or already used.' }, { status: 400 })
  } catch (error) {
    if (error instanceof AuthRequestError) return Response.json({ ok: false, code: 'request', message: error.message }, { status: error.status })
    console.error('[auth-verification] request failed')
    return Response.json({ ok: false, code: 'server', message: 'Verification is temporarily unavailable.' }, { status: 503 })
  }
}
