import type { Mode, RhymeQueryContext, RhymeTargetsDebug } from '@/lib/rhyme-db/queryRhymes'
import type { RhymeDbLoadStatus } from '@/lib/rhyme-db/loadRhymeDb'

export const RHYME_WORKER_INIT_TIMEOUT_MS = 20_000
export const RHYME_WORKER_QUERY_TIMEOUT_MS = 10_000

type InitOk = { type: 'init:ok'; requestId: string; warning?: string; status?: RhymeDbLoadStatus }
type WorkerErrorPayload = { message: string; code?: 'DB_UNAVAILABLE' }
type InitErr = { type: 'init:err'; requestId: string; error: WorkerErrorPayload }
type RhymesOk = {
  type: 'getRhymes:ok'
  requestId: string
  mode: string
  results: { caret?: string[]; lineLast?: string[] }
  debug?: RhymeTargetsDebug
}
type RhymesErr = { type: 'getRhymes:err'; requestId: string; error: WorkerErrorPayload }
type WorkerMessage = InitOk | InitErr | RhymesOk | RhymesErr
type QueryResult = { results: { caret?: string[]; lineLast?: string[] }; debug?: RhymeTargetsDebug }
type TimerHandle = ReturnType<typeof setTimeout>

type PendingRequest<T> = {
  resolve: (value: T) => void
  reject: (error: Error) => void
  timeout: TimerHandle
}

type PendingInit = PendingRequest<void> & { requestId: string; promise: Promise<void> }

export class RhymeWorkerError extends Error {
  code?: 'DB_UNAVAILABLE'

  constructor(message: string, code?: 'DB_UNAVAILABLE') {
    super(message)
    this.name = 'RhymeWorkerError'
    this.code = code
  }
}

const errorFromEvent = (event: ErrorEvent | MessageEvent) => {
  const message = 'message' in event && typeof event.message === 'string' ? event.message : ''
  return new Error(message ? `Rhyme worker failed: ${message}` : 'Rhyme worker message failed')
}

export const createRhymeWorkerClientForWorker = (worker: Worker) => {
  const pending = new Map<string, PendingRequest<QueryResult>>()
  let pendingInit: PendingInit | null = null
  let initialized = false
  let unusableError: Error | null = null
  let terminated = false
  let requestCounter = 0
  let warning: string | null = null
  let status: RhymeDbLoadStatus | null = null

  const nextRequestId = (kind: 'init' | 'query') => `${kind}-${Date.now()}-${requestCounter += 1}`

  const settleInit = (requestId: string, error?: Error) => {
    const current = pendingInit
    if (!current || current.requestId !== requestId) return
    pendingInit = null
    clearTimeout(current.timeout)
    if (error) current.reject(error)
    else {
      initialized = true
      current.resolve()
    }
  }

  const settleQuery = (requestId: string, outcome: { value: QueryResult } | { error: Error }) => {
    const request = pending.get(requestId)
    if (!request) return
    pending.delete(requestId)
    clearTimeout(request.timeout)
    if ('error' in outcome) request.reject(outcome.error)
    else request.resolve(outcome.value)
  }

  const rejectAll = (error: Error) => {
    if (pendingInit) settleInit(pendingInit.requestId, error)
    for (const requestId of [...pending.keys()]) settleQuery(requestId, { error })
  }

  const handleMessage = (event: MessageEvent<WorkerMessage>) => {
    const message = event.data
    if (message.type === 'init:ok') {
      if (pendingInit?.requestId !== message.requestId) return
      warning = message.warning ?? null
      status = message.status ?? null
      settleInit(message.requestId)
      return
    }
    if (message.type === 'init:err') {
      settleInit(message.requestId, new RhymeWorkerError(message.error.message, message.error.code))
      return
    }
    if (message.type === 'getRhymes:ok') {
      settleQuery(message.requestId, { value: { results: message.results, debug: message.debug } })
      return
    }
    settleQuery(message.requestId, {
      error: new RhymeWorkerError(message.error.message, message.error.code),
    })
  }

  const handleWorkerFailure = (event: ErrorEvent | MessageEvent) => {
    if (terminated || unusableError) return
    unusableError = errorFromEvent(event)
    rejectAll(unusableError)
  }

  worker.addEventListener('message', handleMessage)
  worker.onerror = handleWorkerFailure
  worker.onmessageerror = handleWorkerFailure

  const init = () => {
    if (terminated) return Promise.reject(new Error('Rhyme worker terminated'))
    if (unusableError) return Promise.reject(unusableError)
    if (initialized) return Promise.resolve()
    if (pendingInit) return pendingInit.promise

    const requestId = nextRequestId('init')
    let resolvePromise!: () => void
    let rejectPromise!: (error: Error) => void
    const promise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    })
    const timeout = setTimeout(() => {
      settleInit(requestId, new Error(`Rhyme worker initialization timed out after ${RHYME_WORKER_INIT_TIMEOUT_MS}ms`))
    }, RHYME_WORKER_INIT_TIMEOUT_MS)
    pendingInit = { requestId, promise, resolve: resolvePromise, reject: rejectPromise, timeout }

    try {
      worker.postMessage({ type: 'init', requestId, baseUrl: window.location.origin })
    } catch (error) {
      settleInit(requestId, error instanceof Error ? error : new Error('Failed to initialize rhyme worker'))
    }
    return promise
  }

  const getRhymes = async (args: {
    targets: { caret?: string; lineLast?: string }
    mode: Mode
    max: number
    context?: RhymeQueryContext
  }) => {
    await init()
    if (terminated) throw new Error('Rhyme worker terminated')
    if (unusableError) throw unusableError

    const requestId = nextRequestId('query')
    const promise = new Promise<QueryResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        settleQuery(requestId, {
          error: new Error(`Rhyme worker query timed out after ${RHYME_WORKER_QUERY_TIMEOUT_MS}ms`),
        })
      }, RHYME_WORKER_QUERY_TIMEOUT_MS)
      pending.set(requestId, { resolve, reject, timeout })
    })

    try {
      worker.postMessage({ type: 'getRhymes', requestId, ...args })
    } catch (error) {
      settleQuery(requestId, { error: error instanceof Error ? error : new Error('Failed to query rhyme worker') })
    }
    return promise
  }

  const terminate = () => {
    if (terminated) return
    terminated = true
    rejectAll(new Error('Rhyme worker terminated'))
    worker.removeEventListener('message', handleMessage)
    worker.onerror = null
    worker.onmessageerror = null
    worker.terminate()
  }

  return {
    init,
    getRhymes,
    getWarning: () => warning,
    getStatus: () => status,
    terminate,
  }
}
