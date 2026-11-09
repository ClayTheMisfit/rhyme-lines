import { createHmac } from 'node:crypto'

export type AuthRateLimitAction = 'login' | 'login-ip' | 'signup-ip' | 'password-reset' | 'verification-resend' | 'recovery-ip' | 'token'

export function authRateLimitKey(action: AuthRateLimitAction, identity: string, secret: string) {
  return createHmac('sha256', secret).update(`${action}:${identity}`).digest('hex')
}
