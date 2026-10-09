import { readAuthJson, AuthRequestError } from '@/lib/auth/request'
import { consumeAuthRateLimit, getClientAddress } from '@/lib/auth/rate-limit'
import { verifyEmailToken } from '@/lib/auth/service'
import { validatePasswordResetInput } from '@/lib/auth/validation'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const parsed = validatePasswordResetInput(await readAuthJson(request))
    if (!parsed.ok) return Response.json({ ok: false, code: 'validation', fieldErrors: parsed.errors }, { status: 400 })
    const address = getClientAddress(request)
    if (address && !await consumeAuthRateLimit('token', address)) {
      return Response.json({ ok: false, code: 'rate_limited', message: 'Too many attempts. Please try again later.' }, { status: 429 })
    }
    const verified = await verifyEmailToken(parsed.value.token, parsed.value.password)
    return verified
      ? Response.json({ ok: true })
      : Response.json({ ok: false, code: 'invalid_token', message: 'This verification link is invalid, expired, or already used.' }, { status: 400 })
  } catch (error) {
    if (error instanceof AuthRequestError) return Response.json({ ok: false, code: 'request', message: error.message }, { status: error.status })
    console.error('[auth-verification] request failed')
    return Response.json({ ok: false, code: 'server', message: 'Verification is temporarily unavailable.' }, { status: 503 })
  }
}
