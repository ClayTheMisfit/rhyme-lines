import { computeAnalysis, type LineInput } from '@/lib/analysis/compute'
import type { AnalysisErrorV1, AnalysisRequestV1, AnalysisResponseV1 } from '@/lib/analysis/protocol'
import { parseRhymeDbPayload } from '@/lib/rhyme-db/loadRhymeDb'
import { buildHighlightRuntime, type RhymeHighlightRuntime } from '@/lib/rhyme/highlightRuntime'

const RHYME_DB_URL = new URL('/rhyme-db/rhyme-db.v1.json', self.location.origin).toString()

let runtimeCache: RhymeHighlightRuntime | null = null
let runtimePromise: Promise<RhymeHighlightRuntime | null> | null = null

const loadRhymeRuntime = async () => {
  if (runtimeCache) return runtimeCache
  if (runtimePromise) return runtimePromise
  runtimePromise = (async () => {
    try {
      const response = await fetch(RHYME_DB_URL, { cache: 'force-cache' })
      if (!response.ok) {
        return null
      }
      const payload = await response.json()
      const parsed = parseRhymeDbPayload(payload, { expectedVersion: 1, allowLegacy: true })
      runtimeCache = buildHighlightRuntime(parsed.db)
      return runtimeCache
    } catch {
      return null
    }
  })()
  return runtimePromise
}

const postError = (error: AnalysisErrorV1) => {
  self.postMessage(error)
}

self.onmessage = async (event: MessageEvent<AnalysisRequestV1>) => {
  const payload = event.data
  if (!payload || payload.v !== 1) return

  try {
    const lines: LineInput[] = payload.lines ?? []
    const runtime = payload.opts.rhymeHighlights?.enabled ? await loadRhymeRuntime() : null
    const result = computeAnalysis(lines, {
      docId: payload.docId,
      seq: payload.seq,
      rhymeHighlights: payload.opts.rhymeHighlights,
      rhymeRuntime: runtime,
    })
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
