import { act, renderHook } from '@testing-library/react'
import { computeAnalysis } from '@/lib/analysis/compute'
import { tokenizeLine } from '@/lib/analysis/tokenize'
import { useAnalysisWorker } from '@/hooks/useAnalysisWorker'

describe('analysis pipeline', () => {
  it('tokenizes lines with stable offsets', () => {
    const tokens = tokenizeLine("Hello, world! It's fine.")
    expect(tokens).toEqual([
      { start: 0, end: 5, text: 'Hello' },
      { start: 7, end: 12, text: 'world' },
      { start: 14, end: 18, text: "It's" },
      { start: 19, end: 23, text: 'fine' },
    ])
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
