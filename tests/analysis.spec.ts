import { act, renderHook } from '@testing-library/react'
import { computeAnalysis } from '@/lib/analysis/compute'
import { isWordLikeToken, tokenizeLine } from '@/lib/analysis/tokenize'
import { useAnalysisWorker } from '@/hooks/useAnalysisWorker'

describe('analysis pipeline', () => {
  it('tokenizes lines with stable offsets', () => {
    const tokens = tokenizeLine("Hello, world! It's fine.")
    expect(tokens).toEqual([
      { start: 0, end: 5, text: 'Hello', kind: 'word' },
      { start: 7, end: 12, text: 'world', kind: 'word' },
      { start: 14, end: 18, text: "It's", kind: 'word' },
      { start: 19, end: 23, text: 'fine', kind: 'word' },
    ])
  })


  it('keeps curly apostrophe words as single tokens', () => {
    const tokens = tokenizeLine('night’s y’all dogs’')
    expect(tokens).toEqual([
      { start: 0, end: 7, text: 'night’s', kind: 'word' },
      { start: 8, end: 13, text: 'y’all', kind: 'word' },
      { start: 14, end: 19, text: 'dogs’', kind: 'word' },
    ])
    expect(isWordLikeToken('night’s')).toBe(true)
    expect(isWordLikeToken('y’all')).toBe(true)
  })

  it('groups 1-12 am/pm variants into one token', () => {
    expect(tokenizeLine('10 pm lets ride')).toEqual([
      { start: 0, end: 5, text: '10 pm', kind: 'meridiem', analysisKey: '10pm' },
      { start: 6, end: 10, text: 'lets', kind: 'word' },
      { start: 11, end: 15, text: 'ride', kind: 'word' },
    ])
    expect(tokenizeLine('11p.m. sharp')).toEqual([
      { start: 0, end: 6, text: '11p.m.', kind: 'meridiem', analysisKey: '11pm' },
      { start: 7, end: 12, text: 'sharp', kind: 'word' },
    ])
    expect(tokenizeLine('13 pm no')).toEqual([
      { start: 0, end: 2, text: '13', kind: 'word' },
      { start: 3, end: 5, text: 'pm', kind: 'word' },
      { start: 6, end: 8, text: 'no', kind: 'word' },
    ])
  })

  it('groups 12-hour clock times into one token', () => {
    expect(tokenizeLine('12:05 in the morning')).toEqual([
      { start: 0, end: 5, text: '12:05', kind: 'time' },
      { start: 6, end: 8, text: 'in', kind: 'word' },
      { start: 9, end: 12, text: 'the', kind: 'word' },
      { start: 13, end: 20, text: 'morning', kind: 'word' },
    ])
    expect(tokenizeLine('24:05 stays split')).toEqual([
      { start: 0, end: 2, text: '24', kind: 'word' },
      { start: 3, end: 5, text: '05', kind: 'word' },
      { start: 6, end: 11, text: 'stays', kind: 'word' },
      { start: 12, end: 17, text: 'split', kind: 'word' },
    ])
  })

  it('treats digit runs as word-like tokens', () => {
    const tokens = tokenizeLine('one 1 2')
    expect(tokens).toEqual([
      { start: 0, end: 3, text: 'one', kind: 'word' },
      { start: 4, end: 5, text: '1', kind: 'word' },
      { start: 6, end: 7, text: '2', kind: 'word' },
    ])
    expect(isWordLikeToken('1')).toBe(true)
    expect(isWordLikeToken('two')).toBe(true)
    expect(isWordLikeToken('!')).toBe(false)
    expect(isWordLikeToken("'")).toBe(false)
    expect(isWordLikeToken('’')).toBe(false)
    expect(isWordLikeToken({ start: 0, end: 5, text: '10 pm', kind: 'meridiem', analysisKey: '10pm' })).toBe(true)
  })

  it('does not tokenize apostrophe-only runs as words', () => {
    expect(tokenizeLine("' '' ’ ‘")).toEqual([])
  })

  it('computes syllables and totals deterministically', () => {
    const lines = [
      { id: 'l1', text: 'echo room' },
      { id: 'l2', text: 'queue' },
    ]
    const result = computeAnalysis(lines, { docId: 'doc-1', seq: 5 })

    expect(result.v).toBe(1)
    expect(result.docId).toBe('doc-1')
    expect(result.seq).toBe(5)
    expect(result.lineTotals).toEqual({ l1: 3, l2: 1 })
    expect(result.wordSyllables['l1']).toEqual([
      { start: 0, end: 4, syllables: 2 },
      { start: 5, end: 9, syllables: 1 },
    ])
  })

  it('keeps line totals equal to canonical token syllable sums for number lines', () => {
    const line = { id: 'numbers', text: 'testing the syllable count on numbers 173, 232, 99' }
    const result = computeAnalysis([line])
    const tokenSum = result.wordSyllables[line.id].reduce((sum, token) => sum + token.syllables, 0)

    expect(result.lineTotals[line.id]).toBe(tokenSum)
    expect(result.lineTotals[line.id]).toBe(27)
  })

  it('avoids duplicate double-counting in totals', () => {
    const line = { id: 'dedupe', text: 'I blame it on my depression and all my imperfections' }
    const result = computeAnalysis([line])
    const tokenSum = result.wordSyllables[line.id].reduce((sum, token) => sum + token.syllables, 0)

    expect(result.lineTotals[line.id]).toBe(15)
    expect(result.lineTotals[line.id]).toBe(tokenSum)
    const tokens = tokenizeLine(line.text)
    expect(tokens).toHaveLength(10)
    expect(tokens.filter((token) => token.text.toLowerCase() === 'my')).toHaveLength(2)
  })

  it('handles requested regression lines for pronunciation/grouping', () => {
    const lines = [
      { id: 'ampm', text: "10 pm let's get high again" },
      { id: 'ina', text: "I've been ina fucked up state" },
      { id: 'compound', text: 'even while I vibeout' },
    ]

    const result = computeAnalysis(lines)

    const ampmTokens = tokenizeLine(lines[0].text)
    expect(ampmTokens[0]).toEqual({ start: 0, end: 5, text: '10 pm', kind: 'meridiem', analysisKey: '10pm' })
    expect(result.wordSyllables['ampm'][0]?.syllables).toBe(3)
    expect(result.lineTotals['ampm']).toBe(8)

    expect(result.lineTotals['ina']).toBe(8)
    expect(result.lineTotals['compound']).toBe(6)
  })

  it('keeps year/time/full-line regression totals stable', () => {
    const lines = [
      { id: 'y1999', text: '1999' },
      { id: 'y2001', text: '2001' },
      { id: 'y2026', text: '2026' },
      { id: 't1205', text: '12:05' },
      { id: 't1130', text: '11:30' },
      { id: 't0105', text: '1:05' },
      { id: 'l1999', text: '1999 was wild' },
      { id: 'l2001', text: '2001 felt strange' },
      { id: 'l2026', text: '2026 looks bright' },
      { id: 'lock', text: "11 o'clock at night" },
      { id: 'l1205', text: '12:05 in the morning' },
      { id: '247', text: '24/7 on my mind' },
    ]

    const result = computeAnalysis(lines)
    expect(result.lineTotals['y1999']).toBe(5)
    expect(result.lineTotals['y2001']).toBe(4)
    expect(result.lineTotals['y2026']).toBe(5)
    expect(result.lineTotals['t1205']).toBe(3)
    expect(result.lineTotals['t1130']).toBe(4)
    expect(result.lineTotals['t0105']).toBe(3)
    expect(result.lineTotals['l1999']).toBe(7)
    expect(result.lineTotals['l2001']).toBe(6)
    expect(result.lineTotals['l2026']).toBe(7)
    expect(result.lineTotals['lock']).toBe(7)
    expect(result.lineTotals['l1205']).toBe(7)
    expect(result.lineTotals['247']).toBe(8)
  })

  it('falls back to main-thread analysis when worker creation fails', () => {
    jest.useFakeTimers()
    const originalWorker = (global as unknown as { Worker?: typeof Worker }).Worker
    const throwingWorker = class {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_url: URL, _options?: WorkerOptions) {
        throw new Error('worker not available')
      }
    }
    Object.defineProperty(global, 'Worker', { value: throwingWorker, writable: true })

    try {
      const { result } = renderHook(() => useAnalysisWorker('doc-fallback'))
      const lines = [{ id: 'line-1', text: 'echo echo' }]
      const expected = computeAnalysis(lines, { docId: 'doc-fallback', seq: 1 })

      act(() => {
        result.current.scheduleAnalysis(lines, 'typing')
        jest.advanceTimersByTime(300)
      })

      expect(result.current.analysisMode).toBe('fallback')
      expect(result.current.analysis?.lineTotals['line-1']).toBe(expected.lineTotals['line-1'])
    } finally {
      Object.defineProperty(global, 'Worker', { value: originalWorker, writable: true })
      jest.useRealTimers()
    }
  })
})
