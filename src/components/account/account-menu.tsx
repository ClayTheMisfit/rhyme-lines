'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'

type Profile = { name: string | null; email: string | null }
const control = 'rounded-md px-3 py-2 text-xs text-white/80 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]'

export function AccountMenu() {
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let active = true
    let request: AbortController | undefined
    const refresh = async () => {
      request?.abort()
      request = new AbortController()
      try {
        const response = await fetch('/api/account', { cache: 'no-store', signal: request.signal })
        if (!response.ok) throw new Error('Account unavailable')
        const data = await response.json() as { user: Profile | null }
        if (active) { setUser(data.user); setError(false) }
      } catch (cause) {
        if (active && !(cause instanceof DOMException && cause.name === 'AbortError')) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void refresh()
    window.addEventListener('focus', refresh)
    return () => { active = false; request?.abort(); window.removeEventListener('focus', refresh) }
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      // Auth.js handles CSRF and session revocation. No navigation or storage reset.
      const response = await signOut({ redirect: false, redirectTo: '/' })
      if (!response?.url || new URL(response.url, window.location.origin).pathname.startsWith('/api/auth/error')) {
        throw new Error('Sign out failed')
      }
      setUser(null)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setSigningOut(false)
    }
  }

  if (loading) return <span role="status" className="px-3 text-xs text-white/50">Account…</span>
  return (
    <div className="relative">
      {user ? (
        <details>
          <summary className={`${control} cursor-pointer list-none`} aria-label="Account">Account</summary>
          <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-white/10 bg-[#171c23] p-3 shadow-lg">
            <p className="break-words text-sm text-white/90">{user.name || 'Your account'}</p>
            <p className="mt-1 break-words text-xs text-white/60">{user.email}</p>
            <button type="button" className={`${control} mt-3 disabled:opacity-50`} disabled={signingOut} onClick={handleSignOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </details>
      ) : <Link href="/signin" className={control}>Sign in</Link>}
      {error && <p role="status" className="absolute right-0 z-30 mt-2 w-60 rounded-md bg-[#171c23] p-3 text-xs text-white/70">Account unavailable. You can keep writing locally.</p>}
    </div>
  )
}
