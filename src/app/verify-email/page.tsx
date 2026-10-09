import { AuthShell } from '@/components/auth/auth-shell'
import { RecoveryForm, VerifyEmailForm } from '@/components/auth/auth-forms'

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; sent?: string }> }) {
  const { token, sent } = await searchParams
  if (sent && !token) return <AuthShell title="Check your inbox" description="Your account is ready for verification. The link expires after 24 hours."><div className="space-y-6"><p role="status" className="rounded-lg border border-emerald-300/18 bg-emerald-300/[0.05] px-3.5 py-3 text-sm leading-6 text-[#b9dfc8]">We sent a verification link if email delivery is configured. You can safely close this page and keep writing locally.</p><RecoveryForm mode="resend" /></div></AuthShell>
  return <AuthShell title="Confirm your email" description="Verify your address and choose the password that will protect your account. Links are single-use and expire after 24 hours."><VerifyEmailForm token={token} /></AuthShell>
}
