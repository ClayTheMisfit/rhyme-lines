import { readAuthJson, AuthRequestError } from '@/lib/auth/request'
import { consumeAuthRateLimit, getClientAddress } from '@/lib/auth/rate-limit'
import { resetPasswordWithToken } from '@/lib/auth/service'
import { validatePasswordResetInput } from '@/lib/auth/validation'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await readAuthJson(request)
    const parsed = validatePasswordResetInput(body)
    if (!parsed.ok) return Response.json({ ok: false, code: 'validation', fieldErrors: parsed.errors }, { status: 400 })
    if (!await consumeAuthRateLimit('token', getClientAddress(request))) {
      return Response.json({ ok: false, code: 'rate_limited', message: 'Too many attempts. Please try again later.' }, { status: 429 })
    }
    const reset = await resetPasswordWithToken(parsed.value.token, parsed.value.password)
    return reset
      ? Response.json({ ok: true })
      : Response.json({ ok: false, code: 'invalid_token', message: 'This reset link is invalid, expired, or already used.' }, { status: 400 })
  } catch (error) {
    if (error instanceof AuthRequestError) return Response.json({ ok: false, code: 'request', message: error.message }, { status: error.status })
    console.error('[auth-reset] request failed')
    return Response.json({ ok: false, code: 'server', message: 'Password reset is temporarily unavailable.' }, { status: 503 })
  }
}
