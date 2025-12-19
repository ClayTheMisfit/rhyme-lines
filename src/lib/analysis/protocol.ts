export type AnalysisRequestV1 = {
  v: 1
  seq: number
  docId: string
  lines: Array<{ id: string; text: string }>
  opts: { mode: 'typing' | 'caret' }
}

export type AnalysisResponseV1 = {
  v: 1
  seq: number
  docId: string
  lineTotals: Record<string, number>
  wordSyllables: Record<string, Array<{ start: number; end: number; syllables: number }>>
  timing: { computeMs: number }
}

export type AnalysisErrorV1 = {
  v: 1
  seq: number
  docId: string
  message: string
}

export type AnalysisMessageV1 = AnalysisRequestV1 | AnalysisResponseV1 | AnalysisErrorV1
