import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { computeAnalysis, type LineInput } from '@/lib/analysis/compute'
import type { AnalysisErrorV1, AnalysisRequestV1, AnalysisResponseV1 } from '@/lib/analysis/protocol'
import { createAnalysisWorker } from '@/workers/createAnalysisWorker'

type AnalysisMode = 'worker' | 'fallback'
type AnalysisResult = (AnalysisResponseV1 & { roundTripMs?: number }) | null
type InflightAnalysis = { request: AnalysisRequestV1; startedAt: number; timeout: number }

const TYPING_DEBOUNCE_MS = 250
const CARET_DEBOUNCE_MS = 50
export const ANALYSIS_WORKER_TIMEOUT_MS = 10_000
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())

export function useAnalysisWorker(docId: string) {
  const workerRef = useRef<Worker | null>(null)
  const inflightRef = useRef<Map<number, InflightAnalysis>>(new Map())
  const seqRef = useRef(0)
  const latestIdentityRef = useRef({ docId, seq: 0 })
  const currentDocIdRef = useRef(docId)
  const effectDocIdRef = useRef(docId)
  const debounceTimerRef = useRef<number | null>(null)
  const pendingPayloadRef = useRef<AnalysisRequestV1 | null>(null)
  const failedRef = useRef(false)
  const mountedRef = useRef(true)

  if (currentDocIdRef.current !== docId) {
    currentDocIdRef.current = docId
    latestIdentityRef.current = { docId, seq: ++seqRef.current }
    pendingPayloadRef.current = null
    inflightRef.current.forEach(({ timeout }) => window.clearTimeout(timeout))
    inflightRef.current.clear()
  }

  const [analysis, setAnalysis] = useState<AnalysisResult>(null)
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('worker')

  const isCurrent = useCallback(
    (identity: { docId: string; seq: number }) =>
      identity.docId === currentDocIdRef.current &&
      identity.docId === latestIdentityRef.current.docId &&
      identity.seq === latestIdentityRef.current.seq,
    []
  )

  const applyResult = useCallback(
    (result: AnalysisResponseV1, source: AnalysisMode, roundTripMs?: number) => {
      if (!mountedRef.current || !isCurrent(result)) return
      setAnalysis({ ...result, roundTripMs })
      setAnalysisMode(source)
      if (process.env.NODE_ENV !== 'production') {
        const computeMs = result.timing.computeMs.toFixed(2)
        const roundTrip = roundTripMs !== undefined ? roundTripMs.toFixed(2) : 'n/a'
        console.debug('[analysis] result', { seq: result.seq, source, computeMs, roundTrip })
      }
    },
    [isCurrent]
  )

  const handleFallback = useCallback(
    (request: AnalysisRequestV1) => {
      if (!isCurrent(request)) return
      const result = computeAnalysis(request.lines, { docId: request.docId, seq: request.seq })
      applyResult(result, 'fallback')
    },
    [applyResult, isCurrent]
  )

  const failWorker = useCallback(() => {
    failedRef.current = true
    const current = [...inflightRef.current.values()].find(({ request }) => isCurrent(request))?.request
    inflightRef.current.forEach(({ timeout }) => window.clearTimeout(timeout))
    inflightRef.current.clear()
    workerRef.current?.terminate()
    workerRef.current = null
    if (current) handleFallback(current)
  }, [handleFallback, isCurrent])

  const handleMessage = useCallback(
    (event: MessageEvent<AnalysisResponseV1 | AnalysisErrorV1>) => {
      const data = event.data
      if (!data || data.v !== 1) return
      const inflight = inflightRef.current.get(data.seq)
      inflightRef.current.delete(data.seq)
      if (inflight) window.clearTimeout(inflight.timeout)
      if (!isCurrent(data)) return
      if ('message' in data) {
        failedRef.current = true
        workerRef.current?.terminate()
        workerRef.current = null
        if (inflight) handleFallback(inflight.request)
        return
      }
      const roundTripMs = inflight ? Math.max(0, now() - inflight.startedAt) : undefined
      applyResult(data, 'worker', roundTripMs)
    },
    [applyResult, handleFallback, isCurrent]
  )

  const ensureWorker = useCallback((): Worker | null => {
    if (failedRef.current) return null
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return null
    if (workerRef.current) return workerRef.current
    try {
      const worker = createAnalysisWorker()
      if (!worker) {
        failedRef.current = true
        return null
      }
      worker.onmessage = handleMessage
      worker.onerror = failWorker
      worker.onmessageerror = failWorker
      workerRef.current = worker
      return worker
    } catch {
      failedRef.current = true
      return null
    }
  }, [failWorker, handleMessage])

  const dispatchRequest = useCallback(
    (request: AnalysisRequestV1) => {
      if (!isCurrent(request)) return request.seq
      const worker = ensureWorker()
      if (!worker) {
        handleFallback(request)
        return request.seq
      }
      try {
        const timeout = window.setTimeout(failWorker, ANALYSIS_WORKER_TIMEOUT_MS)
        inflightRef.current.set(request.seq, { request, startedAt: now(), timeout })
        worker.postMessage(request)
      } catch {
        const inflight = inflightRef.current.get(request.seq)
        if (inflight) window.clearTimeout(inflight.timeout)
        inflightRef.current.delete(request.seq)
        failedRef.current = true
        worker.terminate()
        workerRef.current = null
        handleFallback(request)
      }
      return request.seq
    },
    [ensureWorker, failWorker, handleFallback, isCurrent]
  )

  const scheduleAnalysis = useCallback(
    (lines: LineInput[], mode: 'typing' | 'caret' = 'typing') => {
      const seq = ++seqRef.current
      const request: AnalysisRequestV1 = {
        v: 1,
        seq,
        docId: currentDocIdRef.current,
        lines,
        opts: { mode },
      }
      latestIdentityRef.current = { docId: request.docId, seq }
      pendingPayloadRef.current = request
      inflightRef.current.forEach(({ timeout }) => window.clearTimeout(timeout))
      inflightRef.current.clear()
      if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current)
      const delay = mode === 'typing' ? TYPING_DEBOUNCE_MS : CARET_DEBOUNCE_MS
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null
        const pending = pendingPayloadRef.current
        if (!pending || !isCurrent(pending)) return
        pendingPayloadRef.current = null
        dispatchRequest(pending)
      }, delay)
      return seq
    },
    [dispatchRequest, isCurrent]
  )

  const computeAnalysisFallback = useCallback(
    (lines: LineInput[]) => {
      const seq = ++seqRef.current
      const request: AnalysisRequestV1 = {
        v: 1,
        seq,
        docId: currentDocIdRef.current,
        lines,
        opts: { mode: 'typing' },
      }
      latestIdentityRef.current = { docId: request.docId, seq }
      pendingPayloadRef.current = null
      inflightRef.current.forEach(({ timeout }) => window.clearTimeout(timeout))
      inflightRef.current.clear()
      const result = computeAnalysis(lines, { docId: request.docId, seq })
      applyResult(result, 'fallback')
      return result
    },
    [applyResult]
  )

  useEffect(() => {
    if (effectDocIdRef.current === docId) return
    effectDocIdRef.current = docId
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    setAnalysis(null)
    setAnalysisMode(failedRef.current ? 'fallback' : 'worker')
  }, [docId])

  useEffect(() => {
    const inflight = inflightRef.current
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current)
      pendingPayloadRef.current = null
      inflight.forEach(({ timeout }) => window.clearTimeout(timeout))
      inflight.clear()
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  const metrics = useMemo(
    () => analysis ? { computeMs: analysis.timing.computeMs, roundTripMs: analysis.roundTripMs, mode: analysisMode } : null,
    [analysis, analysisMode]
  )

  return { analysis, analysisMode, scheduleAnalysis, computeAnalysisFallback, metrics }
}

export type { AnalysisMode, AnalysisResult }
