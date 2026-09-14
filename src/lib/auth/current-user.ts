import 'server-only'
import { auth } from '@/auth'
import { isLocalAnonymousMode } from './environment'

/** Canonical identity boundary for future server-owned resources. Never accepts a client ID. */
export async function getCurrentUser() {
  if (isLocalAnonymousMode()) return null
  const session = await auth()
  if (!session?.user?.id) return null
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
  }
}
