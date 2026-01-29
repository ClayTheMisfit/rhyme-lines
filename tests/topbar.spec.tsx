import { render, screen } from '@testing-library/react'
import TopBar from '@/components/TopBar'

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
})
