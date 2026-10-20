import { AuthShell } from '@/components/auth/auth-shell'
import { RecoveryForm } from '@/components/auth/auth-forms'

export default function ForgotPasswordPage() {
  return <AuthShell title="Reset your password" description="If an eligible account exists, we will send a single-use reset link."><RecoveryForm mode="forgot" /></AuthShell>
}
