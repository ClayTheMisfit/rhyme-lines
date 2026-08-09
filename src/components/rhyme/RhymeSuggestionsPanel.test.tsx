import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RhymeSuggestionsPanel } from '@/components/rhyme/RhymeSuggestionsPanel'
import { useSettingsStore } from '@/store/settingsStore'
import { useRhymePanelStore } from '@/store/rhymePanelStore'
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
    useRhymePanelStore.setState({ searchQuery: '', rhymeSuggestionMode: 'all', selectedIndex: 0 })
    mockedUseRhymeSuggestions.mockClear()
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
    expect(screen.getByRole('button', { name: 'Slant' })).toBeInTheDocument()
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

  it.each([
    ['All', ['perfect', 'near', 'slant']],
    ['Perfect', ['perfect']],
    ['Near', ['near']],
    ['Slant', ['slant']],
  ] as const)('maps %s to a distinct quality set', async (label, modes) => {
    mockedUseRhymeSuggestions.mockReturnValue({
      status: 'success', error: undefined, warning: undefined,
      results: { caret: ['rhyme'], lineLast: [] },
      debug: { caretToken: 'time', lineLastToken: undefined }, rhymeDebug: {},
      meta: { source: 'local' }, phase: 'idle', activeTokens,
    })

    render(<RhymeSuggestionsPanel mode="docked" onClose={() => {}} text="time" caretIndex={4} currentLineText="time" />)
    fireEvent.click(screen.getByRole('button', { name: label }))

    await waitFor(() => expect(mockedUseRhymeSuggestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ modes: [...modes] })
    ))
  })

  it('replaces the line-ending target when Line End suggestions are active', () => {
    mockedUseRhymeSuggestions.mockReturnValue({
      status: 'success', error: undefined, warning: undefined,
      results: { caret: ['glow'], lineLast: ['night'] },
      debug: { caretToken: 'move', lineLastToken: 'light' }, rhymeDebug: {},
      meta: { source: 'local' }, phase: 'idle',
      activeTokens: { ...activeTokens, caretToken: 'move', lineLastToken: 'light' },
    })
    const replaceRhymeTarget = jest.fn(() => true)
    const editorRef = { current: { insertText: jest.fn(), replaceRhymeTarget, focus: jest.fn() } } as any

    render(<RhymeSuggestionsPanel mode="docked" onClose={() => {}} text="move to light" caretIndex={2} currentLineText="move to light" editorRef={editorRef} targetRange={{ start: 0, end: 4, normalizedWord: 'move' }} />)
    fireEvent.click(screen.getByRole('button', { name: /Advanced/i }))
    fireEvent.click(screen.getByRole('button', { name: /Line End/i }))
    fireEvent.click(screen.getByRole('option', { name: /night/i }))

    expect(replaceRhymeTarget).toHaveBeenCalledWith('night', { start: 8, end: 13, normalizedWord: 'light' })
  })

  it('preserves text-navigation keys in the search field', () => {
    mockedUseRhymeSuggestions.mockReturnValue({
      status: 'success', error: undefined, warning: undefined,
      results: { caret: ['rhyme'], lineLast: [] },
      debug: { caretToken: 'time', lineLastToken: undefined }, rhymeDebug: {},
      meta: { source: 'local' }, phase: 'idle', activeTokens,
    })
    render(<RhymeSuggestionsPanel mode="docked" onClose={() => {}} text="time" caretIndex={4} currentLineText="time" />)
    const search = screen.getByRole('textbox', { name: 'Type a word to get rhymes' })
    search.focus()

    for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter']) {
      expect(fireEvent.keyDown(search, { key })).toBe(true)
    }
    expect(search).toHaveFocus()
  })
})
