import { AuthShell } from '@/components/auth/auth-shell'
import { SignInForm } from '@/components/auth/auth-forms'
import { AuthConfigurationError, getAuthEnvironment } from '@/lib/auth/environment'
import { safeRedirectPath } from '@/lib/auth/validation'

export const dynamic = 'force-dynamic'

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const query = await searchParams
  let configured = true
  try { getAuthEnvironment() } catch (cause) {
    if (!(cause instanceof AuthConfigurationError)) throw cause
    configured = false
  }
  return <AuthShell title="Welcome back" description="Return to your writing workspace, or keep working locally without signing in."><SignInForm configured={configured} redirectTo={safeRedirectPath(query.callbackUrl)} initialError={query.error ? 'Sign-in could not be completed. Please try again.' : undefined} /></AuthShell>
}
