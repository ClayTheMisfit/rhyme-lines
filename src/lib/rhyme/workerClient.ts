import type { RhymeWorkerFilters, RhymeWorkerRequest, RhymeWorkerResponse, RhymeWorkerResult } from './workerTypes'
import { createRhymeWorker } from '@/workers/createRhymeWorker'

type PendingRequest = {
  resolve: (result: { data: RhymeWorkerResult; durationMs: number }) => void
  reject: (error: Error) => void
  signal?: AbortSignal
  cleanup?: () => void
}

const pending = new Map<string, PendingRequest>()
let worker: Worker | null = null
let requestCounter = 0

function ensureWorker(): Worker {
  if (worker) return worker
  worker = createRhymeWorker()
  worker.onmessage = (event: MessageEvent<RhymeWorkerResponse>) => {
    const { id, result, error, durationMs } = event.data
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    entry.cleanup?.()
    if (error || !result) {
      entry.reject(new Error(error || 'Worker error'))
      return
    }
    entry.resolve({ data: result, durationMs: durationMs ?? 0 })
  }
  worker.onerror = () => {
    for (const entry of pending.values()) {
      entry.cleanup?.()
      entry.reject(new Error('Worker failed'))
    }
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

function nextRequestId() {
  requestCounter += 1
  return `rhyme-${requestCounter}-${Date.now()}`
}

export async function fetchWorkerRhymes(
  word: string,
  filters: RhymeWorkerFilters,
  signal?: AbortSignal
): Promise<{ data: RhymeWorkerResult; durationMs: number }> {
  const id = nextRequestId()
  const workerInstance = ensureWorker()

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      return
    }

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener('abort', abortHandler)
      }
    }

    const abortHandler = () => {
      pending.delete(id)
      cleanup()
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    pending.set(id, { resolve, reject, signal, cleanup })
    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true })
    }

    const payload: RhymeWorkerRequest = {
      id,
      word,
      filters,
    }
    workerInstance.postMessage(payload)
  })
}
