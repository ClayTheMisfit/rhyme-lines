import { act, renderHook } from '@testing-library/react'
import { useRhymeSuggestions } from '@/lib/rhyme-db/useRhymeSuggestions'
import { getRhymeClient, initRhymeClient } from '@/lib/rhyme-db/rhymeClientSingleton'

jest.mock('@/lib/rhyme-db/rhymeClientSingleton', () => ({
  getRhymeClient: jest.fn(),
  initRhymeClient: jest.fn(),
}))

const mockedGetRhymeClient = getRhymeClient as jest.MockedFunction<typeof getRhymeClient>
const mockedInitRhymeClient = initRhymeClient as jest.MockedFunction<typeof initRhymeClient>

const flushPromises = () => Promise.resolve()

const makeWorkerResponse = (words: string[]) => ({
  results: { caret: words, lineLast: [] },
  debug: {},
})

describe('useRhymeSuggestions', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockedGetRhymeClient.mockReset()
    mockedInitRhymeClient.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('refetches when includeRareWords changes', async () => {
    const getRhymes = jest.fn(async ({ context }) =>
      makeWorkerResponse(context.includeRareWords ? ['rare'] : ['common'])
    )

    mockedGetRhymeClient.mockReturnValue({
      getRhymes,
      getWarning: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })

    const { result, rerender } = renderHook(
      ({ includeRareWords }) =>
        useRhymeSuggestions({
          text: 'time',
          caretIndex: 4,
          currentLineText: 'time',
          modes: ['perfect'],
          includeRareWords,
          debounceMode: 'typing-250',
          enabled: true,
        }),
      { initialProps: { includeRareWords: false } }
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(result.current.results.caret).toEqual(['common'])

    rerender({ includeRareWords: true })

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(result.current.results.caret).toEqual(['rare'])
  })

  it('updates results when multi-syllable rhymes are enabled', async () => {
    const getRhymes = jest.fn(async ({ context }) =>
      makeWorkerResponse(context.multiSyllable ? ['moonwalking'] : ['talking'])
    )

    mockedGetRhymeClient.mockReturnValue({
      getRhymes,
      getWarning: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })

    const { result, rerender } = renderHook(
      ({ multiSyllable }) =>
        useRhymeSuggestions({
          text: 'walking',
          caretIndex: 7,
          currentLineText: 'walking',
          modes: ['perfect'],
          multiSyllable,
          includeRareWords: true,
          debounceMode: 'typing-250',
          enabled: true,
        }),
      { initialProps: { multiSyllable: false } }
    )

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(result.current.results.caret).toEqual(['talking'])

    rerender({ multiSyllable: true })

    await act(async () => {
      jest.advanceTimersByTime(260)
      await flushPromises()
    })

    expect(result.current.results.caret).toEqual(['moonwalking'])
  })

  it('respects debounce timing for typing updates', async () => {
    const getRhymes = jest.fn(async () => makeWorkerResponse(['time']))

    mockedGetRhymeClient.mockReturnValue({
      getRhymes,
      getWarning: () => null,
      init: () => Promise.resolve(),
      terminate: () => {},
    })

    const { rerender } = renderHook(
      ({ text, debounceMode }) =>
        useRhymeSuggestions({
          text,
          caretIndex: text.length,
          currentLineText: text,
          modes: ['perfect'],
          includeRareWords: true,
          debounceMode,
          enabled: true,
        }),
      { initialProps: { text: 'time', debounceMode: 'typing-250' as const } }
    )

    rerender({ text: 'times', debounceMode: 'typing-250' })

    await act(async () => {
      jest.advanceTimersByTime(200)
      await flushPromises()
    })

    expect(getRhymes).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(70)
      await flushPromises()
    })

    expect(getRhymes).toHaveBeenCalled()

    getRhymes.mockClear()

    rerender({ text: 'timer', debounceMode: 'cursor-50' })

    await act(async () => {
      jest.advanceTimersByTime(40)
      await flushPromises()
    })

    expect(getRhymes).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(20)
      await flushPromises()
    })

    expect(getRhymes).toHaveBeenCalled()
  })
})
