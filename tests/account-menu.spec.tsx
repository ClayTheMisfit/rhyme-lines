import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/react'
import { AccountMenu } from '@/components/account/account-menu'
import { signOut } from 'next-auth/react'

jest.mock('next-auth/react', () => ({ signOut: jest.fn() }))

const signOutMock = jest.mocked(signOut)
const fetchMock = jest.fn()
const response = (user: { name: string | null; email: string | null } | null) =>
  ({ ok: true, json: async () => ({ user }) }) as Response

describe('AccountMenu', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockReset()
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock })
    signOutMock.mockReset()
  })

  afterAll(() => { delete (globalThis as { fetch?: typeof fetch }).fetch })

  it('shows sign in for an anonymous user', async () => {
    fetchMock.mockResolvedValue(response(null))
    render(<AccountMenu />)
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin')
  })

  it('shows safe account identity and sign out for an authenticated user', async () => {
    fetchMock.mockResolvedValue(response({ name: 'Avery', email: 'avery@example.com' }))
    render(<AccountMenu />)
    await userEvent.click(await screen.findByText('Account'))
    expect(screen.getByText('Avery')).toBeInTheDocument()
    expect(screen.getByText('avery@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('transitions to anonymous UI after sign out without clearing local drafts', async () => {
    const draft = JSON.stringify({ version: 3, drafts: [{ id: 'local-draft' }] })
    localStorage.setItem('rhyme-lines:persist:drafts', draft)
    fetchMock.mockResolvedValue(response({ name: 'Avery', email: 'avery@example.com' }))
    signOutMock.mockResolvedValue({ url: 'http://localhost/' })

    render(<AccountMenu />)
    await userEvent.click(await screen.findByText('Account'))
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument())
    expect(signOutMock).toHaveBeenCalledWith({ redirect: false, redirectTo: '/' })
    expect(localStorage.getItem('rhyme-lines:persist:drafts')).toBe(draft)
  })
})
