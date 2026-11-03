import { render, screen } from '@testing-library/react'
import PrivacyPage from '@/app/privacy/page'
import TermsPage from '@/app/terms/page'
import { DashboardFooter } from '@/components/dashboard/dashboard-footer'

describe('public legal pages', () => {
  it('describes the implemented privacy data flows without rendering private values', () => {
    const { container } = render(<PrivacyPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
    expect(container).toHaveTextContent(/current release, account access uses Google sign-in/i)
    expect(container).toHaveTextContent(/OAuth records returned for the connection/i)
    expect(container).toHaveTextContent(/not available in this release/i)
    expect(container).toHaveTextContent(/content-free deletion tombstone/i)
    expect(container).not.toHaveTextContent(/scrypt password hash|password-reset links expire|Resend/i)
    expect(container).not.toHaveTextContent(/postgres(?:ql)?:\/\//i)
    expect(container).not.toHaveTextContent(/RESEND_API_KEY|AUTH_SECRET|DATABASE_URL/)
  })

  it('publishes terms with local-storage and account limitations', () => {
    render(<TermsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument()
    expect(screen.getByText(/browser storage is not a guaranteed backup/i)).toBeInTheDocument()
    expect(screen.getByText(/does not provide self-service account deletion/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Privacy Policy' }).length).toBeGreaterThan(0)
  })

  it('keeps the dashboard legal links readable and keyboard focusable', () => {
    render(<DashboardFooter />)

    for (const name of ['Privacy', 'Terms']) {
      const link = screen.getByRole('link', { name })
      expect(link).toHaveClass('text-[#9da0a4]')
      expect(link).toHaveClass('focus-visible:ring-2')
    }
  })
})
