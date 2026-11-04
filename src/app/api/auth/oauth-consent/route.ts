import { NextResponse } from 'next/server'
import { getAuthEnvironment } from '@/lib/auth/environment'
import { createOAuthConsentToken, OAUTH_CONSENT_COOKIE, OAUTH_CONSENT_MAX_AGE_SECONDS } from '@/lib/auth/oauth-consent'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (body?.acceptedTerms !== true) {
    return NextResponse.json({ ok: false, message: 'Legal acknowledgement is required for a new Google account.' }, { status: 400 })
  }
  const environment = getAuthEnvironment()
  const response = NextResponse.json({ ok: true })
  response.cookies.set(OAUTH_CONSENT_COOKIE, createOAuthConsentToken(environment.secret), {
    httpOnly: true,
    maxAge: OAUTH_CONSENT_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
