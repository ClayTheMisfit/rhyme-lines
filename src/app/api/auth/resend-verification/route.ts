import { readAuthJson, AuthRequestError } from '@/lib/auth/request'
import { consumeAuthRateLimit, getClientAddress } from '@/lib/auth/rate-limit'
import { resendVerificationEmail } from '@/lib/auth/service'
import { validateEmail } from '@/lib/auth/validation'

export const runtime = 'nodejs'
const generic = { ok: true, message: 'If an unverified account exists, a new link is on its way.' }

export async function POST(request: Request) {
  try {
    const body = await readAuthJson(request) as Record<string, unknown>
    const email = validateEmail(body?.email)
    if (!email) return Response.json({ ok: false, code: 'validation', fieldErrors: { email: 'Enter a valid email address.' } }, { status: 400 })
    const address = getClientAddress(request)
    const [identityAllowed, addressAllowed] = await Promise.all([
      consumeAuthRateLimit('recovery', address ? `${address}:${email}` : email),
      address ? consumeAuthRateLimit('recovery-ip', address) : Promise.resolve(true),
    ])
    if (identityAllowed && addressAllowed) await resendVerificationEmail(email)
    return Response.json(generic, { status: 202 })
  } catch (error) {
    if (error instanceof AuthRequestError) return Response.json({ ok: false, code: 'request', message: error.message }, { status: error.status })
    console.error('[auth-verification] resend request failed')
    return Response.json(generic, { status: 202 })
  }
}
