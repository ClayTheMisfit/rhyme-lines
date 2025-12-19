import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { computeAnalysis, type LineInput } from '@/lib/analysis/compute'
import type { AnalysisErrorV1, AnalysisRequestV1, AnalysisResponseV1 } from '@/lib/analysis/protocol'
import { createAnalysisWorker } from '@/workers/createAnalysisWorker'

type AnalysisMode = 'worker' | 'fallback'

type AnalysisResult = (AnalysisResponseV1 & { roundTripMs?: number }) | null

const TYPING_DEBOUNCE_MS = 250
const CARET_DEBOUNCE_MS = 50

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())

export function useAnalysisWorker(docId: string) {
  const workerRef = useRef<Worker | null>(null)
  const inflightRef = useRef<Map<number, number>>(new Map())
  const seqRef = useRef(0)
  const latestSeqRef = useRef(0)
  const debounceTimerRef = useRef<number | null>(null)
  const pendingPayloadRef = useRef<{ lines: LineInput[]; mode: 'typing' | 'caret' } | null>(null)
  const failedRef = useRef(false)

  const [analysis, setAnalysis] = useState<AnalysisResult>(null)
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('worker')

  const applyResult = useCallback(
    (result: AnalysisResponseV1, source: AnalysisMode, roundTripMs?: number) => {
      const decorated: AnalysisResponseV1 & { roundTripMs?: number } = {
        ...result,
        roundTripMs,
      }
      setAnalysis(decorated)
      setAnalysisMode(source)
      if (process.env.NODE_ENV !== 'production') {
        const computeMs = result.timing.computeMs.toFixed(2)
        const roundTrip = roundTripMs !== undefined ? roundTripMs.toFixed(2) : 'n/a'
        console.debug('[analysis] result', { seq: result.seq, source, computeMs, roundTrip })
      }
    },
    []
  )

  const handleFallback = useCallback(
    (payload: { lines: LineInput[]; seq: number }) => {
      const result = computeAnalysis(payload.lines, { docId, seq: payload.seq })
      applyResult(result, 'fallback')
    },
    [applyResult, docId]
  )

  const handleMessage = useCallback(
    (event: MessageEvent<AnalysisResponseV1 | AnalysisErrorV1>) => {
      const data = event.data
      if (!data || data.v !== 1) return
      if ('message' in data) {
        inflightRef.current.delete(data.seq)
        failedRef.current = true
        handleFallback({ lines: pendingPayloadRef.current?.lines ?? [], seq: data.seq })
        return
      }
      if (data.docId !== docId) {
        inflightRef.current.delete(data.seq)
        return
      }
      const startedAt = inflightRef.current.get(data.seq)
      inflightRef.current.delete(data.seq)
      if (data.seq < latestSeqRef.current) return

      latestSeqRef.current = data.seq
      const roundTripMs = typeof startedAt === 'number' ? Math.max(0, now() - startedAt) : undefined
      applyResult(data, 'worker', roundTripMs)
    },
    [applyResult, docId, handleFallback]
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
      worker.onerror = () => {
        failedRef.current = true
      }
      workerRef.current = worker
      return worker
    } catch (error) {
      failedRef.current = true
      return null
    }
  }, [handleMessage])

  const dispatchRequest = useCallback(
    (lines: LineInput[], mode: 'typing' | 'caret') => {
      const seq = ++seqRef.current
      latestSeqRef.current = seq
      const payload: AnalysisRequestV1 = { v: 1, seq, docId, lines, opts: { mode } }
      const worker = ensureWorker()

      if (!worker) {
        handleFallback({ lines, seq })
        return seq
      }

      try {
        inflightRef.current.set(seq, now())
        worker.postMessage(payload)
      } catch {
        inflightRef.current.delete(seq)
        failedRef.current = true
        handleFallback({ lines, seq })
      }
      return seq
    },
    [docId, ensureWorker, handleFallback]
  )

  const scheduleAnalysis = useCallback(
    (lines: LineInput[], mode: 'typing' | 'caret' = 'typing') => {
      pendingPayloadRef.current = { lines, mode }
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
      }
      const delay = mode === 'typing' ? TYPING_DEBOUNCE_MS : CARET_DEBOUNCE_MS
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null
        const pending = pendingPayloadRef.current
        if (!pending) return
        dispatchRequest(pending.lines, pending.mode)
      }, delay)
    },
    [dispatchRequest]
  )

  const computeAnalysisFallback = useCallback(
    (lines: LineInput[]) => {
      const seq = ++seqRef.current
      const result = computeAnalysis(lines, { docId, seq })
      applyResult(result, 'fallback')
      return result
    },
    [applyResult, docId]
  )

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
      }
      inflightRef.current.clear()
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  const metrics = useMemo(
    () =>
      analysis
        ? { computeMs: analysis.timing.computeMs, roundTripMs: analysis.roundTripMs, mode: analysisMode }
        : null,
    [analysis, analysisMode]
  )

  return { analysis, analysisMode, scheduleAnalysis, computeAnalysisFallback, metrics }
}

export type { AnalysisMode, AnalysisResult }
