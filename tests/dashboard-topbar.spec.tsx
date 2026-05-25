import { fireEvent, render, screen } from '@testing-library/react'
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar'

describe('DashboardTopbar', () => {
  it('renders Projects/Archived controls without desktop-only hiding', () => {
    const onViewChange = jest.fn()
    render(
      <DashboardTopbar
        view="projects"
        onViewChange={onViewChange}
        archivedCount={2}
        trashCount={1}
        search=""
        onSearchChange={jest.fn()}
      />
    )

    const nav = screen.getByRole('navigation', { name: 'Dashboard views' })
    expect(nav.className).not.toContain('md:flex')
    expect(screen.getByRole('button', { name: /Projects/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Archived/i })).toBeInTheDocument()
  })

  it('uses a single controlled view state and toggles archived button', () => {
    const onViewChange = jest.fn()
    const { rerender } = render(
      <DashboardTopbar
        view="projects"
        onViewChange={onViewChange}
        archivedCount={3}
        trashCount={0}
        search=""
        onSearchChange={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Archived/i }))
    expect(onViewChange).toHaveBeenCalledWith('archived')

    rerender(
      <DashboardTopbar
        view="archived"
        onViewChange={onViewChange}
        archivedCount={3}
        trashCount={0}
        search=""
        onSearchChange={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Archived/i })).toHaveAttribute('aria-pressed', 'true')
  })
})
