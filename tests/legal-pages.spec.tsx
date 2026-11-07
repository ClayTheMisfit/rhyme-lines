import { render, screen } from '@testing-library/react'
import PrivacyPage from '@/app/privacy/page'
import TermsPage from '@/app/terms/page'
import { DashboardFooter } from '@/components/dashboard/dashboard-footer'

describe('public legal pages', () => {
  it('describes the implemented privacy data flows without rendering private values', () => {
    const { container } = render(<PrivacyPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
    expect(container).toHaveTextContent(/supports email-and-password accounts/i)
    expect(container).toHaveTextContent(/salted scrypt password hash/i)
    expect(container).toHaveTextContent(/verification links expire after 24 hours/i)
    expect(container).toHaveTextContent(/Resend/i)
    expect(container).toHaveTextContent(/encrypted, HTTP-only JSON Web Token cookie/i)
    expect(container).toHaveTextContent(/OAuth records returned for the connection/i)
    expect(container).toHaveTextContent(/content-free deletion tombstone/i)
    expect(container).toHaveTextContent(/independently operated personal software project/i)
    expect(container).toHaveTextContent(/Zoho Mail/i)
    expect(container).toHaveTextContent(/no self-service workflow for exporting or deleting an entire account/i)
    expect(screen.getAllByRole('link', { name: 'support@rhymelines.net' }).length).toBeGreaterThan(0)
    expect(container).not.toHaveTextContent(/postgres(?:ql)?:\/\//i)
    expect(container).not.toHaveTextContent(/RESEND_API_KEY|AUTH_SECRET|DATABASE_URL/)
  })

  it('publishes terms with local-storage and account limitations', () => {
    render(<TermsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument()
    expect(screen.getByText(/browser storage is not a guaranteed backup/i)).toBeInTheDocument()
    expect(screen.getByText(/does not provide self-service account deletion/i)).toBeInTheDocument()
    expect(screen.getByText(/independently operated personal software project/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'support@rhymelines.net' }).length).toBeGreaterThan(0)
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
