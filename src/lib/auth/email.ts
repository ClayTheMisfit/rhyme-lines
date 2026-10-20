import 'server-only'
import { getAuthEmailEnvironment } from './environment'

export type AuthEmailKind = 'verify' | 'reset'
export type AuthEmailMessage = { kind: AuthEmailKind; to: string; token: string }
export type AuthEmailSender = (message: AuthEmailMessage) => Promise<void>

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export const sendAuthEmail: AuthEmailSender = async ({ kind, to, token }) => {
  const environment = getAuthEmailEnvironment()
  const path = kind === 'verify' ? '/verify-email' : '/reset-password'
  const link = new URL(path, environment.baseUrl)
  link.searchParams.set('token', token)
  const action = kind === 'verify' ? 'Verify your email' : 'Reset your password'
  const subject = kind === 'verify' ? 'Verify your Rhyme Lines email' : 'Reset your Rhyme Lines password'
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${environment.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: environment.from,
      to: [to],
      subject,
      text: `${action}: ${link.toString()}\n\nIf you did not request this, you can ignore this message.`,
      html: `<p>${escapeHtml(action)}:</p><p><a href="${escapeHtml(link.toString())}">${escapeHtml(action)}</a></p><p>If you did not request this, you can ignore this message.</p>`,
    }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Auth email provider returned ${response.status}`)
}
