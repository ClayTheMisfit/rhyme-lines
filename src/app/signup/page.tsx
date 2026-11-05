import { AuthShell } from '@/components/auth/auth-shell'
import { SignupForm } from '@/components/auth/auth-forms'
import { isRegistrationEnabled } from '@/lib/auth/environment'

export default function SignupPage() {
  const registrationEnabled = isRegistrationEnabled()
  return <AuthShell title={registrationEnabled ? 'Create your account' : 'Account registration is closed'} description={registrationEnabled ? 'Add account-backed features without changing or uploading the drafts already on this device.' : 'New accounts are not available yet. You can keep writing locally, or sign in if you already have an account.'}><SignupForm registrationEnabled={registrationEnabled} /></AuthShell>
}
