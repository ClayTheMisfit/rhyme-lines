import type { Mode } from '@/lib/rhyme-db/queryRhymes'
import type { RhymeQueryContext } from '@/lib/rhyme-db/queryRhymes'

type InitOk = { type: 'init:ok' }

type InitErr = { type: 'init:err'; error: string }

type RhymesOk = {
  type: 'getRhymes:ok'
  requestId: string
  mode: string
  results: { caret?: string[]; lineLast?: string[] }
  meta?: { caret?: import('@/lib/rhyme-db/queryRhymes').RhymeSuggestionMeta; lineLast?: import('@/lib/rhyme-db/queryRhymes').RhymeSuggestionMeta }
}

type RhymesErr = { type: 'getRhymes:err'; requestId: string; error: string }

type WorkerMessage = InitOk | InitErr | RhymesOk | RhymesErr

type PendingRequest = {
  resolve: (value: { caret?: string[]; lineLast?: string[]; meta?: { caret?: import('@/lib/rhyme-db/queryRhymes').RhymeSuggestionMeta; lineLast?: import('@/lib/rhyme-db/queryRhymes').RhymeSuggestionMeta } }) => void
  reject: (error: Error) => void
}

export const createRhymeWorkerClient = () => {
  const worker = new Worker(new URL('../../workers/rhymeWorker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<string, PendingRequest>()
  let initPromise: Promise<void> | null = null
  let requestCounter = 0

  const handleMessage = (event: MessageEvent<WorkerMessage>) => {
    const message = event.data
    if (message.type === 'init:ok') {
      return
    }

    if (message.type === 'init:err') {
      return
    }

    if (message.type === 'getRhymes:ok') {
      const request = pending.get(message.requestId)
      if (request) {
        pending.delete(message.requestId)
        request.resolve(message.results)
      }
      return
    }

    if (message.type === 'getRhymes:err') {
      const request = pending.get(message.requestId)
      if (request) {
        pending.delete(message.requestId)
        request.reject(new Error(message.error))
      }
    }
  }

  worker.addEventListener('message', handleMessage)

  const init = () => {
    if (!initPromise) {
      if (typeof window === 'undefined') {
        return Promise.reject(new Error('Rhyme worker init requires a browser environment'))
      }
      initPromise = new Promise<void>((resolve, reject) => {
        const onInitMessage = (event: MessageEvent<WorkerMessage>) => {
          const message = event.data
          if (message.type === 'init:ok') {
            worker.removeEventListener('message', onInitMessage)
            resolve()
          }
          if (message.type === 'init:err') {
            worker.removeEventListener('message', onInitMessage)
            reject(new Error(message.error))
          }
        }

        worker.addEventListener('message', onInitMessage)
        worker.postMessage({ type: 'init', baseUrl: window.location.origin })
      })
    }

    return initPromise
  }

  const getRhymes = async (args: {
    targets: { caret?: string; lineLast?: string }
    mode: Mode
    max: number
    context?: RhymeQueryContext
  }) => {
    await init()
    const requestId = `${Date.now()}-${requestCounter += 1}`

    const promise = new Promise<{ caret?: string[]; lineLast?: string[]; meta?: { caret?: import('@/lib/rhyme-db/queryRhymes').RhymeSuggestionMeta; lineLast?: import('@/lib/rhyme-db/queryRhymes').RhymeSuggestionMeta } }>((resolve, reject) => {
      pending.set(requestId, { resolve, reject })
    })

    worker.postMessage({
      type: 'getRhymes',
      requestId,
      targets: args.targets,
      mode: args.mode,
      max: args.max,
      context: args.context,
    })

    return promise
  }

  const terminate = () => {
    pending.forEach((request) => {
      request.reject(new Error('Worker terminated'))
    })
    pending.clear()
    worker.terminate()
  }

  return {
    init,
    getRhymes,
    terminate,
  }
}
