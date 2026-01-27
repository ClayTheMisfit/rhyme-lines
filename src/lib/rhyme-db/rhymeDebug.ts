import type { Mode } from '@/lib/rhyme-db/queryRhymes'

export type RhymeDebugCap = {
  applied: boolean
  limit?: number
  stage?: string
}

export type RhymeSuggestionDebug = {
  rawTarget: string
  normalizedTarget: string
  activeModes: Mode[]
  poolCount?: number
  filteredCount: number
  renderedCount?: number
  stageCounts: Record<string, number>
  rejections: Record<string, number>
  cap?: RhymeDebugCap
  meta?: { updatedAt: number; debounceMs?: number }
}

export type RhymeSuggestionDebugState = {
  caret?: RhymeSuggestionDebug
  lineLast?: RhymeSuggestionDebug
}
