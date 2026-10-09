import { readAuthJson, AuthRequestError } from '@/lib/auth/request'
import { consumeAuthRateLimit, getClientAddress } from '@/lib/auth/rate-limit'
import { registerPasswordAccount } from '@/lib/auth/service'
import { validateSignupInput } from '@/lib/auth/validation'
import { AuthConfigurationError, getAuthEmailEnvironment } from '@/lib/auth/environment'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await readAuthJson(request)
    const parsed = validateSignupInput(body)
    if (!parsed.ok) return Response.json({ ok: false, code: 'validation', fieldErrors: parsed.errors }, { status: 400 })
    // Do not create an account that cannot receive its required verification link.
    getAuthEmailEnvironment()
    const address = getClientAddress(request)
    if (address && !await consumeAuthRateLimit('signup-ip', address)) {
      return Response.json({ ok: false, code: 'rate_limited', message: 'Too many attempts. Please try again later.' }, { status: 429 })
    }
    const result = await registerPasswordAccount(parsed.value)
    if (result.ok) return Response.json({ ok: true }, { status: 201 })
    if (result.reason === 'email') {
      return result.accountPreserved
        ? Response.json({ ok: false, code: 'verification_delivery_failed_resend', message: 'Your account is pending, but the verification email could not be sent. Use resend verification to try again.' }, { status: 503 })
        : Response.json({ ok: false, code: 'verification_delivery_failed_retry', message: 'The verification email could not be sent. Please retry signup.' }, { status: 503 })
    }
    if (result.reason === 'server') {
      return Response.json({ ok: false, code: 'server', message: 'Account creation is temporarily unavailable.' }, { status: 503 })
    }
    return Response.json({ ok: false, code: 'account_unavailable', message: 'An account cannot be created with those details. Try signing in or recovering your password.' }, { status: 400 })
  } catch (error) {
    if (error instanceof AuthRequestError) return Response.json({ ok: false, code: 'request', message: error.message }, { status: error.status })
    if (error instanceof AuthConfigurationError) {
      console.error(error.message)
      return Response.json({ ok: false, code: 'email_unavailable', message: 'Account email is not configured on this server.' }, { status: 503 })
    }
    console.error('[auth-signup] request failed')
    return Response.json({ ok: false, code: 'server', message: 'Account creation is temporarily unavailable.' }, { status: 503 })
  }
}
