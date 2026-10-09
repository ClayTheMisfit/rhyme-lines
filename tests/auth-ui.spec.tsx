import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignInForm, SignupForm, VerifyEmailForm } from '@/components/auth/auth-forms'
import { signIn } from 'next-auth/react'

const push = jest.fn()
const refresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))
jest.mock('next-auth/react', () => ({ signIn: jest.fn() }))

const signInMock = jest.mocked(signIn)

describe('auth forms', () => {
  beforeEach(() => {
    push.mockReset(); refresh.mockReset(); signInMock.mockReset()
  })

  it('exposes labelled signup fields and defers password choice until verification', () => {
    render(<SignupForm />)
    expect(screen.getByLabelText('Name')).toHaveAttribute('autocomplete', 'name')
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByText(/choose your password/i)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin')
  })

  it('requires the email owner to choose a password during verification', () => {
    render(<VerifyEmailForm token="verification-token" />)
    expect(screen.getByLabelText('Choose password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByRole('button', { name: 'Verify email and set password' })).toBeEnabled()
  })

  it('settles loading state after a signup server failure', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('offline'))
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock })
    render(<SignupForm />)
    await userEvent.type(screen.getByLabelText('Name'), 'Avery')
    await userEvent.type(screen.getByLabelText('Email'), 'avery@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your connection')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue with email' })).toBeEnabled())
  })

  it('shows a generic credential failure and re-enables login', async () => {
    signInMock.mockResolvedValue({ error: 'CredentialsSignin', code: 'credentials', status: 200, ok: false, url: null })
    render(<SignInForm configured redirectTo="/" />)
    await userEvent.type(screen.getByLabelText('Email'), 'unknown@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'this is a secure passphrase')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('shows inline login validation without sending malformed credentials', async () => {
    render(<SignInForm configured redirectTo="/" />)
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter a valid email address.')).toHaveAttribute('role', 'alert')
    expect(screen.getByText('Use 12–128 characters.')).toHaveAttribute('role', 'alert')
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('offers verification resend when signup persisted but email delivery failed', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ ok: false, code: 'verification_delivery_failed_resend', message: 'Delivery failed.' }),
      }),
    })
    render(<SignupForm />)
    await userEvent.type(screen.getByLabelText('Name'), 'Avery')
    await userEvent.type(screen.getByLabelText('Email'), 'avery@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect(await screen.findByRole('link', { name: 'Resend verification email' })).toHaveAttribute('href', '/verify-email')
  })

  it('does not offer resend when failed delivery removed the pending account', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ ok: false, code: 'verification_delivery_failed_retry', message: 'Please retry signup.' }),
      }),
    })
    render(<SignupForm />)
    await userEvent.type(screen.getByLabelText('Name'), 'Avery')
    await userEvent.type(screen.getByLabelText('Email'), 'avery@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please retry signup.')
    expect(screen.queryByRole('link', { name: 'Resend verification email' })).not.toBeInTheDocument()
  })

  it('keeps Google OAuth available', async () => {
    signInMock.mockResolvedValue(undefined)
    render(<SignInForm configured redirectTo="/workspace" />)
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(signInMock).toHaveBeenCalledWith('google', { redirectTo: '/workspace' })
  })
})
