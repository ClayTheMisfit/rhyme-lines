import { AuthShell } from '@/components/auth/auth-shell'
import { SignInForm } from '@/components/auth/auth-forms'
import { AuthConfigurationError, getAuthEnvironment, isRegistrationEnabled } from '@/lib/auth/environment'
import { safeRedirectPath } from '@/lib/auth/validation'

export const dynamic = 'force-dynamic'

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const query = await searchParams
  let configured = true
  let googleEnabled = false
  try {
    googleEnabled = getAuthEnvironment().google !== null
  } catch (cause) {
    if (!(cause instanceof AuthConfigurationError)) throw cause
    configured = false
  }
  const registrationEnabled = isRegistrationEnabled()
  const initialError = query.error === 'GoogleTermsRequired'
    ? 'Creating a new account with Google requires agreeing to the Terms of Service and acknowledging the Privacy Policy.'
    : query.error === 'RegistrationDisabled'
      ? 'New account registration is not currently available. Existing users can continue to sign in.'
    : query.error ? 'Sign-in could not be completed. Please try again.'
      : !registrationEnabled ? 'New account registration is not currently available. Existing users can continue to sign in.' : undefined
  return <AuthShell title="Welcome back" description="Return to your writing workspace, or keep working locally without signing in."><SignInForm configured={configured} googleEnabled={googleEnabled} registrationEnabled={registrationEnabled} redirectTo={safeRedirectPath(query.callbackUrl)} initialError={initialError} /></AuthShell>
}
