import { render, screen } from '@testing-library/react'
import TopBar from '@/components/TopBar'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}))

jest.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: 'dark',
    setTheme: jest.fn(),
  }),
}))

describe('TopBar', () => {
  test('does not render the detach toggle in the top nav', () => {
    render(<TopBar />)

    expect(screen.queryByTitle('Detach rhyme panel')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Dock rhyme panel')).not.toBeInTheDocument()
  })

  test('renders a back to dashboard control in the editor header', () => {
    render(<TopBar />)

    const backLink = screen.getByRole('link', { name: 'Back to dashboard' })
    const header = screen.getByTestId('editor-header')

    expect(backLink).toBeInTheDocument()
    expect(backLink).toHaveAttribute('href', '/')
    expect(header.className).toContain('bg-[color:var(--rl-shell-chrome)]')
    expect(header.className).not.toContain('bg-[#0d0d0f]')
  })

  test('keeps the document header and top bar actions visible', () => {
    render(<TopBar />)

    expect(screen.getByRole('button', { name: 'Rename document title' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Toggle theme' })).not.toBeInTheDocument()
    expect(screen.queryByText('Document')).not.toBeInTheDocument()
  })
})
