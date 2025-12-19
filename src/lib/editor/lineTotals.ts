import { computeAnalysis, type LineInput } from '@/lib/analysis/compute'

export function splitNormalizedLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return normalized.split('\n')
}

export function computeLineTotals(text: string, lines?: string[]): number[] {
  const resolvedLines = lines ?? splitNormalizedLines(text)
  const lineInputs: LineInput[] = resolvedLines.map((line, index) => ({
    id: `line-${index}`,
    text: line,
  }))

  const analysis = computeAnalysis(lineInputs, { docId: 'line-totals', seq: 0 })
  return lineInputs.map((line) => analysis.lineTotals[line.id] ?? 0)
}
