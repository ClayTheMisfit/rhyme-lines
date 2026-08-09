import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { RhymeSuggestionsPanel } from '@/components/rhyme/RhymeSuggestionsPanel'
import { useSettingsStore } from '@/store/settingsStore'
import { useRhymeSuggestions } from '@/lib/rhyme-db/useRhymeSuggestions'

jest.mock('@/lib/rhyme-db/useRhymeSuggestions')

const mockedUseRhymeSuggestions = useRhymeSuggestions as jest.MockedFunction<typeof useRhymeSuggestions>

const activeTokens = {
  caretToken: 'time',
  lineLastToken: null,
  rawCaretToken: 'time',
  rawLineLastToken: null,
}

describe('RhymeSuggestionsPanel', () => {
  beforeEach(() => {
    useSettingsStore.setState({})
  })

  it('shows the common-only hint when no results are available', () => {
    mockedUseRhymeSuggestions.mockReturnValue({
      status: 'success',
      error: undefined,
      warning: undefined,
      results: { caret: [], lineLast: [] },
      debug: { caretToken: 'time', lineLastToken: undefined },
      rhymeDebug: {},
      meta: { source: 'local' },
      phase: 'idle',
      activeTokens,
    })

    render(
      <RhymeSuggestionsPanel
        mode="docked"
        onClose={() => {}}
        text="time"
        caretIndex={4}
        currentLineText="time"
      />
    )

    expect(
      screen.getByText('No strong matches yet. Try Near.')
    ).toBeInTheDocument()
  })

  it('removes the spelling variants toggle and keeps core controls visible', () => {
    mockedUseRhymeSuggestions.mockReturnValue({
      status: 'success',
      error: undefined,
      warning: undefined,
      results: { caret: ['time'], lineLast: [] },
      debug: { caretToken: 'time', lineLastToken: undefined },
      rhymeDebug: {},
      meta: { source: 'local' },
      phase: 'idle',
      activeTokens,
    })

    render(
      <RhymeSuggestionsPanel
        mode="docked"
        onClose={() => {}}
        text="time"
        caretIndex={4}
        currentLineText="time"
      />
    )

    expect(screen.queryByText('Show spelling variants')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Perfect' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Near' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Slant' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /time/i })).toBeInTheDocument()
  })

  it('keeps quick assist available in hidden mode and continues fetching suggestions', () => {
    mockedUseRhymeSuggestions.mockReturnValue({
      status: 'success',
      error: undefined,
      warning: undefined,
      results: { caret: ['rhyme', 'time'], lineLast: [] },
      debug: { caretToken: 'time', lineLastToken: undefined },
      rhymeDebug: {},
      meta: { source: 'local' },
      phase: 'idle',
      activeTokens,
    })

    render(
      <RhymeSuggestionsPanel
        mode="hidden"
        onClose={() => {}}
        text="time"
        caretIndex={4}
        currentLineText="time"
      />
    )

    expect(screen.getByTestId('rhyme-quick-assist')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'rhyme' })).toBeInTheDocument()
    expect(mockedUseRhymeSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true })
    )
  })
})
