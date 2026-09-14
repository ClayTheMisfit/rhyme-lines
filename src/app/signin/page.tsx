import Link from 'next/link'
import { signIn } from '@/auth'
import { AuthConfigurationError, getAuthEnvironment } from '@/lib/auth/environment'

export const dynamic = 'force-dynamic'

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  let configured = true
  try { getAuthEnvironment() } catch (cause) {
    if (!(cause instanceof AuthConfigurationError)) throw cause
    configured = false
  }
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-sm space-y-6" aria-labelledby="signin-title">
        <Link href="/" className="text-sm text-muted-foreground focus-visible:outline-2">Rhyme Lines</Link>
        <h1 id="signin-title" className="text-2xl font-medium">Sign in to your account</h1>
        <p className="text-sm text-muted-foreground">Write first. Sign in when you want account-backed features. Your projects stay on this device; cloud sync is not available yet.</p>
        {error && <p role="alert" className="text-sm">Sign-in could not be completed. Please try again.</p>}
        {configured ? (
          <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }) }}>
            <button className="w-full rounded-md bg-foreground px-4 py-3 text-sm text-background focus-visible:outline-2 focus-visible:outline-offset-4">Continue with Google</button>
          </form>
        ) : <p role="status" className="text-sm">Sign-in is not configured on this server. You can still use the local workspace.</p>}
        <Link href="/" className="block rounded-md py-3 text-center text-sm underline underline-offset-4 focus-visible:outline-2">Continue without an account</Link>
      </section>
    </main>
  )
}
