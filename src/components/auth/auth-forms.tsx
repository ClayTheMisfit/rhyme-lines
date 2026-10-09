'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { signIn } from 'next-auth/react'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validateEmail, validatePassword, type FieldErrors } from '@/lib/auth/validation'

const inputClass = 'min-h-12 w-full rounded-lg border border-white/12 bg-white/[0.035] px-3.5 text-base text-white outline-none placeholder:text-white/24 hover:border-white/20 focus:border-[#d6b85d]/75 focus:ring-2 focus:ring-[#d6b85d]/18 disabled:opacity-50 sm:text-sm'
const buttonClass = 'flex min-h-12 w-full items-center justify-center rounded-lg bg-[#ece9df] px-4 text-sm font-semibold text-[#111216] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d] focus-visible:ring-offset-3 focus-visible:ring-offset-[#090a0d] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none'
const secondaryButtonClass = 'flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/12 bg-transparent px-4 text-sm font-medium text-white/82 hover:border-white/22 hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d] disabled:opacity-55'

type ApiResult = { ok: boolean; code?: string; message?: string; fieldErrors?: FieldErrors }

function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: ReactNode }) {
  const errorId = `${name}-error`
  return <div className="space-y-2"><label htmlFor={name} className="text-sm font-medium text-white/78">{label}</label>{children}{error && <p id={errorId} role="alert" className="text-sm text-[#e8a8a8]">{error}</p>}</div>
}

function PasswordField({ id, label, autoComplete, error, value, onChange }: { id: string; label: string; autoComplete: string; error?: string; value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false)
  return <Field label={label} name={id} error={error}><div className="relative"><input id={id} name={id} className={`${inputClass} pr-24`} type={visible ? 'text' : 'password'} autoComplete={autoComplete} required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} /><button type="button" className="absolute inset-y-0 right-1 min-w-20 rounded-md px-3 text-xs text-white/52 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setVisible((current) => !current)}>{visible ? 'Hide' : 'Show'}</button></div></Field>
}

function Status({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null
  return <p role={error ? 'alert' : 'status'} aria-live="polite" className={`rounded-lg border px-3.5 py-3 text-sm leading-6 ${error ? 'border-red-300/18 bg-red-300/[0.05] text-[#efb2b2]' : 'border-emerald-300/18 bg-emerald-300/[0.05] text-[#b9dfc8]'}`}>{error || success}</p>
}

async function postJson(url: string, body: unknown): Promise<{ response: Response; data: ApiResult }> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json() as ApiResult
  return { response, data }
}

export function SignInForm({ configured, redirectTo, initialError }: { configured: boolean; redirectTo: string; initialError?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState<'google' | 'credentials' | null>(null)
  const [error, setError] = useState(initialError || '')
  const [errors, setErrors] = useState<FieldErrors>({})
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending) return
    const nextErrors: FieldErrors = {}
    if (!validateEmail(email)) nextErrors.email = 'Enter a valid email address.'
    if (!validatePassword(password)) nextErrors.password = `Use ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.`
    setErrors(nextErrors); setError('')
    if (Object.keys(nextErrors).length) return
    setPending('credentials')
    try {
      const result = await signIn('credentials', { email, password, redirect: false, redirectTo })
      if (!result || result.error) throw new Error('invalid')
      router.push(redirectTo); router.refresh()
    } catch { setError('Email or password is incorrect, or the email has not been verified.'); setPending(null) }
  }
  async function google() {
    if (pending) return
    setPending('google'); setError('')
    try { await signIn('google', { redirectTo }) } catch { setError('Google sign-in could not be started. Please try again.'); setPending(null) }
  }
  if (!configured) return <Status error="Sign-in is not configured on this server. You can keep writing locally." />
  return <div className="space-y-6"><Status error={error} /><button type="button" className={secondaryButtonClass} disabled={!!pending} onClick={google}><span aria-hidden="true" className="font-semibold text-[#d6b85d]">G</span>{pending === 'google' ? 'Opening Google…' : 'Continue with Google'}</button><div className="flex items-center gap-3 text-[0.68rem] tracking-[0.12em] text-white/34"><span className="h-px flex-1 bg-white/10" />OR CONTINUE WITH EMAIL<span className="h-px flex-1 bg-white/10" /></div><form className="space-y-5" onSubmit={submit} noValidate><Field label="Email" name="email" error={errors.email}><input id="email" name="email" className={inputClass} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: undefined })) }} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} /></Field><PasswordField id="password" label="Password" autoComplete="current-password" value={password} onChange={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })) }} error={errors.password} /><div className="flex justify-end"><Link href="/forgot-password" className="text-sm text-white/60 underline decoration-white/20 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]">Forgot password?</Link></div><button className={buttonClass} disabled={!!pending}>{pending === 'credentials' ? 'Signing in…' : 'Sign in'}</button></form><p className="text-center text-sm text-white/48">New to Rhyme Lines? <Link href="/signup" className="text-white/82 underline decoration-white/25 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]">Create an account</Link></p></div>
}

export function SignupForm() {
  const router = useRouter()
  const [values, setValues] = useState({ name: '', email: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [needsResend, setNeedsResend] = useState(false)
  const [pending, setPending] = useState(false)
  const update = (key: keyof typeof values) => (value: string) => setValues((current) => ({ ...current, [key]: value }))
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending) return
    setPending(true); setErrors({}); setError(''); setNeedsResend(false)
    try {
      const { response, data } = await postJson('/api/auth/signup', values)
      if (!response.ok) { setErrors(data.fieldErrors || {}); setError(data.message || 'Account creation could not be completed.'); setNeedsResend(data.code === 'verification_delivery_failed_resend'); return }
      router.push('/verify-email?sent=1')
    } catch { setError('Account creation could not be completed. Check your connection and try again.') } finally { setPending(false) }
  }
  return <form className="space-y-5" onSubmit={submit} noValidate><Status error={error} />{needsResend && <Link href="/verify-email" className={secondaryButtonClass}>Resend verification email</Link>}<Field label="Name" name="name" error={errors.name}><input id="name" name="name" className={inputClass} autoComplete="name" required maxLength={80} value={values.name} onChange={(event) => update('name')(event.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} /></Field><Field label="Email" name="email" error={errors.email}><input id="email" name="email" className={inputClass} type="email" autoComplete="email" required maxLength={254} value={values.email} onChange={(event) => update('email')(event.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} /></Field><p className="text-sm leading-6 text-white/48">We will email you a secure link. Open it to verify your address and choose your password.</p><button className={buttonClass} disabled={pending}>{pending ? 'Sending verification…' : 'Continue with email'}</button><p className="text-center text-sm text-white/48">Already have an account? <Link href="/signin" className="text-white/82 underline decoration-white/25 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]">Sign in</Link></p></form>
}

export function RecoveryForm({ mode }: { mode: 'forgot' | 'resend' }) {
  const id = useId()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending) return
    setPending(true); setError(''); setSuccess('')
    try {
      const { response, data } = await postJson(mode === 'forgot' ? '/api/auth/forgot-password' : '/api/auth/resend-verification', { email })
      if (!response.ok) { setError(data.fieldErrors?.email || data.message || 'Request could not be completed.'); return }
      setSuccess(data.message || 'If an eligible account exists, an email is on its way.')
    } catch { setError('Request could not be completed. Check your connection and try again.') } finally { setPending(false) }
  }
  return <form className="space-y-5" onSubmit={submit} noValidate><Status error={error} success={success} /><Field label="Email" name={id}><input id={id} name="email" className={inputClass} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></Field><button className={buttonClass} disabled={pending}>{pending ? 'Sending…' : mode === 'forgot' ? 'Send reset link' : 'Resend verification'}</button><Link href="/signin" className="flex min-h-12 items-center justify-center text-sm text-white/60 underline decoration-white/20 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85d]">Back to sign in</Link></form>
}

export function VerifyEmailForm({ token }: { token?: string }) {
  const [values, setValues] = useState({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [pending, setPending] = useState(false)
  const [state, setState] = useState<'idle' | 'success' | 'error'>(token ? 'idle' : 'error')
  const [message, setMessage] = useState(token ? '' : 'This verification link is missing or invalid.')
  async function verify(event: FormEvent) {
    event.preventDefault()
    if (!token || pending) return
    const password = validatePassword(values.password)
    const nextErrors: FieldErrors = {}
    if (!password) nextErrors.password = `Use ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.`
    if (!password || values.confirmPassword !== password) nextErrors.confirmPassword = 'Passwords must match.'
    setErrors(nextErrors); setMessage('')
    if (Object.keys(nextErrors).length) return
    setPending(true)
    try {
      const { response, data } = await postJson('/api/auth/verify-email', { token, ...values })
      if (!response.ok) { setErrors(data.fieldErrors || {}); setState('error'); setMessage(data.message || 'Verification could not be completed.'); return }
      setState('success'); setMessage('Your email is verified and your password is ready. You can now sign in.')
    } catch { setState('error'); setMessage('Verification could not be completed. Check your connection and try again.') } finally { setPending(false) }
  }
  return <div className="space-y-5"><Status error={state === 'error' ? message : undefined} success={state === 'success' ? message : undefined} />{state !== 'success' && token && <form className="space-y-5" onSubmit={verify} noValidate><PasswordField id="password" label="Choose password" autoComplete="new-password" value={values.password} onChange={(password) => { setValues((current) => ({ ...current, password })); setErrors((current) => ({ ...current, password: undefined })) }} error={errors.password} /><p className="-mt-2 text-xs leading-5 text-white/38">Use at least {PASSWORD_MIN_LENGTH} characters. A long passphrase is welcome; symbol rules are not required.</p><PasswordField id="confirmPassword" label="Confirm password" autoComplete="new-password" value={values.confirmPassword} onChange={(confirmPassword) => { setValues((current) => ({ ...current, confirmPassword })); setErrors((current) => ({ ...current, confirmPassword: undefined })) }} error={errors.confirmPassword} /><button className={buttonClass} disabled={pending}>{pending ? 'Activating account…' : 'Verify email and set password'}</button></form>}{state === 'success' && <Link href="/signin" className={buttonClass}>Continue to sign in</Link>}<div className="border-t border-white/10 pt-5"><p className="mb-4 text-sm text-white/48">Need a fresh verification link?</p><RecoveryForm mode="resend" /></div></div>
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [values, setValues] = useState({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState(token ? '' : 'This reset link is missing or invalid.')
  const [success, setSuccess] = useState('')
  const [pending, setPending] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!token || pending) return
    setPending(true); setErrors({}); setError('')
    try {
      const { response, data } = await postJson('/api/auth/reset-password', { token, ...values })
      if (!response.ok) { setErrors(data.fieldErrors || {}); setError(data.message || 'Password reset could not be completed.'); return }
      setSuccess('Your password has been reset. Other signed-in sessions have been invalidated.')
    } catch { setError('Password reset could not be completed. Check your connection and try again.') } finally { setPending(false) }
  }
  if (success) return <div className="space-y-5"><Status success={success} /><Link href="/signin" className={buttonClass}>Sign in with your new password</Link></div>
  return <form className="space-y-5" onSubmit={submit} noValidate><Status error={error} /><PasswordField id="password" label="New password" autoComplete="new-password" value={values.password} onChange={(password) => setValues((current) => ({ ...current, password }))} error={errors.password} /><PasswordField id="confirmPassword" label="Confirm new password" autoComplete="new-password" value={values.confirmPassword} onChange={(confirmPassword) => setValues((current) => ({ ...current, confirmPassword }))} error={errors.confirmPassword} /><button className={buttonClass} disabled={pending || !token}>{pending ? 'Resetting password…' : 'Reset password'}</button></form>
}
