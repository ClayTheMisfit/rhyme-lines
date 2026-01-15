import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { RhymeSuggestionsPanel } from '@/components/rhyme/RhymeSuggestionsPanel'
import { useSettingsStore } from '@/store/settingsStore'
import { useRhymeSuggestions } from '@/lib/rhyme-db/useRhymeSuggestions'

jest.mock('@/lib/rhyme-db/useRhymeSuggestions')

const mockedUseRhymeSuggestions = useRhymeSuggestions as jest.MockedFunction<typeof useRhymeSuggestions>

describe('RhymeSuggestionsPanel', () => {
  beforeEach(() => {
    useSettingsStore.setState({ includeRareRhymes: false })
  })

  it('shows the common-only hint when no results are available', () => {
    mockedUseRhymeSuggestions.mockReturnValue({
      status: 'ready',
      error: undefined,
      results: { caret: [], lineLast: [] },
      debug: { caretToken: 'time', lineLastToken: undefined },
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
      screen.getByText('No common perfect rhymes — try Near/Slant or enable Rare words.')
    ).toBeInTheDocument()
  })
})
