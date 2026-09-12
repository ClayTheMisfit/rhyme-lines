import { act, renderHook } from '@testing-library/react'
import { ANALYSIS_WORKER_TIMEOUT_MS, useAnalysisWorker } from '@/hooks/useAnalysisWorker'
import { createAnalysisWorker } from '@/workers/createAnalysisWorker'
import type { AnalysisRequestV1, AnalysisResponseV1 } from '@/lib/analysis/protocol'
import * as analysisCompute from '@/lib/analysis/compute'

jest.mock('@/workers/createAnalysisWorker', () => ({
  createAnalysisWorker: jest.fn(),
}))

const mockedCreateWorker = createAnalysisWorker as jest.MockedFunction<typeof createAnalysisWorker>

class FakeAnalysisWorker {
  onmessage: Worker['onmessage'] = null
  onerror: Worker['onerror'] = null
  onmessageerror: Worker['onmessageerror'] = null
  posted: AnalysisRequestV1[] = []
  terminate = jest.fn()

  postMessage = jest.fn((message: AnalysisRequestV1) => {
    this.posted.push(message)
  })

  respond(request: AnalysisRequestV1, total: number) {
    const response: AnalysisResponseV1 = {
      v: 1,
      seq: request.seq,
      docId: request.docId,
      lineTotals: { [request.lines[0]?.id ?? 'line']: total },
      wordSyllables: {},
      timing: { computeMs: 1 },
    }
    this.onmessage?.({ data: response } as MessageEvent<AnalysisResponseV1>)
  }

  respondError(request: AnalysisRequestV1, message = 'analysis failed') {
    this.onmessage?.({
      data: { v: 1, seq: request.seq, docId: request.docId, message },
    } as MessageEvent)
  }

  crash() {
    this.onerror?.({ message: 'worker crashed' } as ErrorEvent)
  }

  messageError() {
    this.onmessageerror?.({ data: null } as MessageEvent)
  }
}

const line = (id: string, text: string) => [{ id, text }]

describe('useAnalysisWorker request freshness', () => {
  let worker: FakeAnalysisWorker
  const OriginalWorker = global.Worker

  beforeEach(() => {
    jest.useFakeTimers()
    Object.defineProperty(global, 'Worker', { value: FakeAnalysisWorker, writable: true })
    worker = new FakeAnalysisWorker()
    mockedCreateWorker.mockReturnValue(worker as unknown as Worker)
  })

  afterEach(() => {
    Object.defineProperty(global, 'Worker', { value: OriginalWorker, writable: true })
    jest.useRealTimers()
    mockedCreateWorker.mockReset()
  })

  it('ignores an old result as soon as newer text is scheduled during debounce', () => {
    const { result } = renderHook(() => useAnalysisWorker('project-a'))

    act(() => {
      result.current.scheduleAnalysis(line('a', 'old words'))
      jest.advanceTimersByTime(250)
    })
    const oldRequest = worker.posted[0]

    act(() => {
      result.current.scheduleAnalysis(line('a', 'newer words are current'))
      worker.respond(oldRequest, 99)
    })

    expect(result.current.analysis).toBeNull()
  })

  it('keeps the newer result when worker responses arrive out of order', () => {
    const { result } = renderHook(() => useAnalysisWorker('project-a'))

    act(() => {
      result.current.scheduleAnalysis(line('a', 'old'))
      jest.advanceTimersByTime(250)
      result.current.scheduleAnalysis(line('a', 'new'))
      jest.advanceTimersByTime(250)
    })
    const [oldRequest, newRequest] = worker.posted

    act(() => worker.respond(newRequest, 2))
    act(() => worker.respond(oldRequest, 9))

    expect(result.current.analysis?.lineTotals.a).toBe(2)
    expect(result.current.analysisMode).toBe('worker')
  })

  it('ignores an old error after a newer worker result succeeds', () => {
    const { result } = renderHook(() => useAnalysisWorker('project-a'))

    act(() => {
      result.current.scheduleAnalysis(line('a', 'old'))
      jest.advanceTimersByTime(250)
      result.current.scheduleAnalysis(line('a', 'new words'))
      jest.advanceTimersByTime(250)
    })
    const [oldRequest, newRequest] = worker.posted

    act(() => worker.respond(newRequest, 2))
    act(() => worker.respondError(oldRequest))

    expect(result.current.analysis?.seq).toBe(newRequest.seq)
    expect(result.current.analysisMode).toBe('worker')
  })

  it('ignores a response from the previously active document', () => {
    const { result, rerender } = renderHook(({ docId }) => useAnalysisWorker(docId), {
      initialProps: { docId: 'project-a' },
    })

    act(() => {
      result.current.scheduleAnalysis(line('a', 'project a'))
      jest.advanceTimersByTime(250)
    })
    const requestA = worker.posted[0]

    rerender({ docId: 'project-b' })
    act(() => worker.respond(requestA, 7))

    expect(result.current.analysis).toBeNull()
  })

  it.each(['crash', 'messageError'] as const)('settles current work through fallback on %s', (failure) => {
    const { result } = renderHook(() => useAnalysisWorker('project-a'))

    act(() => {
      result.current.scheduleAnalysis(line('a', 'echo echo'))
      jest.advanceTimersByTime(250)
      worker[failure]()
    })

    expect(result.current.analysisMode).toBe('fallback')
    expect(result.current.analysis?.lineTotals.a).toBe(4)
  })

  it('uses fallback for a current request error', () => {
    const { result } = renderHook(() => useAnalysisWorker('project-a'))

    act(() => {
      result.current.scheduleAnalysis(line('a', 'echo echo'))
      jest.advanceTimersByTime(250)
      worker.respondError(worker.posted[0])
    })

    expect(result.current.analysisMode).toBe('fallback')
    expect(result.current.analysis?.lineTotals.a).toBe(4)
  })

  it('times out a silent worker request and settles through fallback', () => {
    const { result } = renderHook(() => useAnalysisWorker('project-a'))

    act(() => {
      result.current.scheduleAnalysis(line('a', 'echo echo'))
      jest.advanceTimersByTime(250 + ANALYSIS_WORKER_TIMEOUT_MS)
    })

    expect(result.current.analysisMode).toBe('fallback')
    expect(result.current.analysis?.lineTotals.a).toBe(4)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('discards fallback output if a newer revision becomes current while it computes', () => {
    const actualCompute = analysisCompute.computeAnalysis
    const { result } = renderHook(() => useAnalysisWorker('project-a'))
    const computeSpy = jest.spyOn(analysisCompute, 'computeAnalysis').mockImplementation((lines, options) => {
      computeSpy.mockImplementation(actualCompute)
      result.current.scheduleAnalysis(line('a', 'new revision'))
      return actualCompute(lines, options)
    })

    act(() => {
      result.current.scheduleAnalysis(line('a', 'old revision'))
      jest.advanceTimersByTime(250)
      worker.crash()
    })

    expect(result.current.analysis).toBeNull()
    computeSpy.mockRestore()
  })
})
