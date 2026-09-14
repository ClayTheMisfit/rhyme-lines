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
    // The client uses this non-secret ID only to partition local sync associations by account.
    return Response.json({ user: user ? { id: user.id, name: user.name, email: user.email } : null }, { headers })
  } catch (error) {
    if (error instanceof AuthConfigurationError) console.error(error.message)
    return Response.json({ error: 'Account unavailable. You can keep writing locally.' }, { status: 503, headers })
  }
}
