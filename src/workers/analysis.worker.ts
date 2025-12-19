import { computeAnalysis, type LineInput } from '@/lib/analysis/compute'
import type { AnalysisErrorV1, AnalysisRequestV1, AnalysisResponseV1 } from '@/lib/analysis/protocol'

const postError = (error: AnalysisErrorV1) => {
  self.postMessage(error)
}

self.onmessage = (event: MessageEvent<AnalysisRequestV1>) => {
  const payload = event.data
  if (!payload || payload.v !== 1) return

  try {
    const lines: LineInput[] = payload.lines ?? []
    const result = computeAnalysis(lines, { docId: payload.docId, seq: payload.seq })
    const response: AnalysisResponseV1 = {
      ...result,
      v: 1,
      seq: payload.seq,
      docId: payload.docId,
    }
    self.postMessage(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown analysis failure'
    postError({ v: 1, seq: payload.seq, docId: payload.docId, message })
  }
}
