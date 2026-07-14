import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RhymeThesaurusSection } from '@/components/rhyme/RhymeThesaurusSection'
import { useRhymeThesaurus } from '@/lib/thesaurus/useRhymeThesaurus'
import { useRhymeSuggestions } from '@/lib/rhyme-db/useRhymeSuggestions'

jest.mock('@/lib/thesaurus/useRhymeThesaurus')
jest.mock('@/lib/rhyme-db/useRhymeSuggestions')

const mockedThesaurus = useRhymeThesaurus as jest.MockedFunction<typeof useRhymeThesaurus>
const mockedRhymes = useRhymeSuggestions as jest.MockedFunction<typeof useRhymeSuggestions>

const baseThesaurusResult = {
  target: 'dream',
  concepts: [
    { word: 'vision', normalizedWord: 'vision', relationship: 'synonym' as const, score: 10, source: 'datamuse' as const },
    { word: 'goal', normalizedWord: 'goal', relationship: 'related' as const, score: 8, source: 'datamuse' as const },
  ],
  synonyms: [{ word: 'vision', normalizedWord: 'vision', relationship: 'synonym' as const, score: 10, source: 'datamuse' as const }],
  related: [{ word: 'goal', normalizedWord: 'goal', relationship: 'related' as const, score: 8, source: 'datamuse' as const }],
}

const rhymeReturn = (caret: string[] = []) => ({
  status: caret.length ? 'success' as const : 'idle' as const,
  error: undefined,
  warning: undefined,
  results: { caret, lineLast: [] },
  debug: {},
  rhymeDebug: {},
  meta: { source: 'local' as const },
  phase: 'idle' as const,
  activeTokens: { caretToken: 'vision', lineLastToken: 'vision', rawCaretToken: 'vision', rawLineLastToken: 'vision' },
})

const renderSection = (props = {}) => render(
  <RhymeThesaurusSection
    target="dream"
    modes={['perfect', 'near']}
    commonWordsOnly={false}
    multiSyllable={false}
    panelMode="docked"
    onInsertRhyme={jest.fn()}
    {...props}
  />
)

describe('RhymeThesaurusSection', () => {
  beforeEach(() => {
    mockedThesaurus.mockReturnValue({ status: 'success', phase: 'idle', result: baseThesaurusResult, normalizedTarget: 'dream', refresh: jest.fn() })
    mockedRhymes.mockReturnValue(rhymeReturn())
  })

  it('is closed by default and does not enable lookup until opened', async () => {
    const user = userEvent.setup()
    renderSection()
    const trigger = screen.getByRole('button', { name: /explore meanings/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: /rhyme thesaurus/i })).not.toBeInTheDocument()
    expect(mockedThesaurus).toHaveBeenLastCalledWith({ target: 'dream', enabled: false })

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Meaning paths for “dream”')).toBeInTheDocument()
    await waitFor(() => expect(mockedThesaurus).toHaveBeenLastCalledWith({ target: 'dream', enabled: true }))
  })

  it('does not render in hidden mode', () => {
    renderSection({ panelMode: 'hidden' })
    expect(screen.queryByRole('button', { name: /explore meanings/i })).not.toBeInTheDocument()
  })

  it('separates concept groups, selecting a concept does not insert, and rhymes insert via callback', async () => {
    const user = userEvent.setup()
    const onInsertRhyme = jest.fn()
    mockedRhymes.mockReturnValue(rhymeReturn(['decision', 'collision']))
    renderSection({ onInsertRhyme, commonWordsOnly: true, multiSyllable: true })

    await user.click(screen.getByRole('button', { name: /explore meanings/i }))
    expect(screen.getByText('Synonyms')).toBeInTheDocument()
    expect(screen.getByText('Related concepts')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'vision' }))
    expect(screen.getByRole('button', { name: 'vision' })).toHaveAttribute('aria-pressed', 'true')
    expect(onInsertRhyme).not.toHaveBeenCalled()
    expect(mockedRhymes).toHaveBeenLastCalledWith(expect.objectContaining({ queryToken: 'vision', commonWordsOnly: true, multiSyllable: true, enabled: true }))

    await user.click(screen.getByRole('button', { name: 'decision' }))
    expect(onInsertRhyme).toHaveBeenCalledWith('decision')
  })

  it('shows accessible loading, empty, and error states', async () => {
    const user = userEvent.setup()
    mockedThesaurus.mockReturnValue({ status: 'loading', phase: 'initial', result: null, normalizedTarget: 'dream', refresh: jest.fn() })
    const { rerender } = renderSection()
    await user.click(screen.getByRole('button', { name: /explore meanings/i }))
    expect(screen.getByRole('status')).toHaveTextContent('Finding related meanings…')

    mockedThesaurus.mockReturnValue({ status: 'success', phase: 'idle', result: { target: 'dream', concepts: [], synonyms: [], related: [] }, normalizedTarget: 'dream', refresh: jest.fn() })
    rerender(<RhymeThesaurusSection target="dream" modes={['perfect']} commonWordsOnly={false} multiSyllable={false} panelMode="docked" onInsertRhyme={jest.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('No useful meaning alternatives found.')
  })
})
