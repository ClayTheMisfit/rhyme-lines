export interface RhymeWorkerFilters {
  perfect: boolean
  near: boolean
  slant: boolean
}

export interface RhymeWorkerRequest {
  id: string
  word: string
  filters: RhymeWorkerFilters
}

export interface RhymeWorkerResult {
  perfect: string[]
  near: string[]
  slant: string[]
}

export interface RhymeWorkerResponse {
  id: string
  result?: RhymeWorkerResult
  error?: string
  durationMs?: number
}
