import { getCurrentUser } from '@/lib/auth/current-user'
import { AuthConfigurationError, isAuthCompletelyUnconfigured } from '@/lib/auth/environment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' }
  if (isAuthCompletelyUnconfigured()) {
    return Response.json({ user: null, configured: false }, { headers })
  }
  try {
    const user = await getCurrentUser()
    // The account UI does not need the stable internal ID.
    return Response.json({ user: user ? { name: user.name, email: user.email } : null }, { headers })
  } catch (error) {
    if (error instanceof AuthConfigurationError) console.error(error.message)
    return Response.json({ error: 'Account unavailable. You can keep writing locally.' }, { status: 503, headers })
  }
}
