import { render, screen } from '@testing-library/react'
import StatusBar from '@/components/StatusBar'

jest.mock('@/store/autosaveStore', () => ({
  useAutosaveStore: (selector: (state: { status: string }) => unknown) =>
    selector({ status: 'saved' }),
}))

jest.mock('@/store/rhymeHighlightSettingsStore', () => ({
  useRhymeHighlightSettingsStore: (selector: (state: { highlightMode: string }) => unknown) =>
    selector({ highlightMode: 'end' }),
}))

describe('StatusBar line metrics', () => {
  test('shows 0 lines for truly empty text', () => {
    render(<StatusBar text="" cursor={null} />)

    expect(screen.getByText('Words 0')).toBeInTheDocument()
    expect(screen.getByText('Lines 0')).toBeInTheDocument()
  })

  test('ignores scaffold-only blank newlines in line count', () => {
    render(<StatusBar text={'\n\n'} cursor={null} />)

    expect(screen.getByText('Words 0')).toBeInTheDocument()
    expect(screen.getByText('Lines 0')).toBeInTheDocument()
  })

  test('counts meaningful lines and keeps intentional interior blank lines', () => {
    render(<StatusBar text={'Verse one\n\nVerse two'} cursor={{ line: 3, column: 2 }} />)

    expect(screen.getByText('Words 4')).toBeInTheDocument()
    expect(screen.getByText('Lines 3')).toBeInTheDocument()
    expect(screen.getByText('Ln 3, Col 2')).toBeInTheDocument()
  })
})
