import { AuthShell } from '@/components/auth/auth-shell'
import { SignupForm } from '@/components/auth/auth-forms'

export default function SignupPage() {
  return <AuthShell title="Create your account" description="Add account-backed features without changing or uploading the drafts already on this device."><SignupForm /></AuthShell>
}
