import { AuthShell } from '@/components/auth/auth-shell'
import { ResetPasswordForm } from '@/components/auth/auth-forms'

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return <AuthShell title="Choose a new password" description="Reset links are single-use and expire after one hour."><ResetPasswordForm token={token} /></AuthShell>
}
