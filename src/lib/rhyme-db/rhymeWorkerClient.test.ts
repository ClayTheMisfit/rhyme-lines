import {
  createRhymeWorkerClientForWorker,
  RHYME_WORKER_INIT_TIMEOUT_MS,
  RHYME_WORKER_QUERY_TIMEOUT_MS,
} from './rhymeWorkerClientCore'

type Listener = (event: MessageEvent) => void

class FakeRhymeWorker {
  static instances: FakeRhymeWorker[] = []
  listeners = new Map<string, Set<Listener>>()
  posted: unknown[] = []
  onerror: Worker['onerror'] = null
  onmessageerror: Worker['onmessageerror'] = null
  terminate = jest.fn()

  constructor() {
    FakeRhymeWorker.instances.push(this)
  }

  addEventListener = jest.fn((type: string, listener: Listener) => {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  })

  removeEventListener = jest.fn((type: string, listener: Listener) => {
    this.listeners.get(type)?.delete(listener)
  })

  postMessage = jest.fn((message: unknown) => {
    this.posted.push(message)
  })

  emit(data: unknown) {
    this.listeners.get('message')?.forEach((listener) => listener({ data } as MessageEvent))
  }

  crash() {
    const handler = this.onerror as ((event: ErrorEvent) => unknown) | null
    handler?.call(this as unknown as Worker, { message: 'worker crashed' } as ErrorEvent)
  }

  messageError() {
    const handler = this.onmessageerror as ((event: MessageEvent) => unknown) | null
    handler?.call(this as unknown as Worker, { data: null } as MessageEvent)
  }
}

const flush = () => Promise.resolve()

describe('rhyme worker client request settlement', () => {
  const OriginalWorker = global.Worker

  beforeEach(() => {
    jest.useFakeTimers()
    FakeRhymeWorker.instances = []
    Object.defineProperty(global, 'Worker', { value: FakeRhymeWorker, writable: true })
  })

  afterEach(() => {
    Object.defineProperty(global, 'Worker', { value: OriginalWorker, writable: true })
    jest.useRealTimers()
  })

  const makeClient = () => {
    const worker = new FakeRhymeWorker()
    const client = createRhymeWorkerClientForWorker(worker as unknown as Worker)
    return { client, worker }
  }

  const initialize = async (client: ReturnType<typeof createRhymeWorkerClientForWorker>, worker: FakeRhymeWorker) => {
    const promise = client.init()
    const request = worker.posted.at(-1) as { requestId: string }
    worker.emit({ type: 'init:ok', requestId: request.requestId })
    await expect(promise).resolves.toBeUndefined()
  }

  const beginQuery = (client: ReturnType<typeof createRhymeWorkerClientForWorker>) =>
    client.getRhymes({ targets: { caret: 'time' }, mode: 'perfect', max: 20 })

  it('initializes successfully', async () => {
    const { client, worker } = makeClient()
    await initialize(client, worker)
    expect(client.getWarning()).toBeNull()
  })

  it('rejects initialization when the worker crashes', async () => {
    const { client, worker } = makeClient()
    const promise = client.init()
    worker.crash()
    await expect(promise).rejects.toThrow('worker crashed')
    expect(jest.getTimerCount()).toBe(0)
  })

  it('rejects an initialization error response and permits a later retry', async () => {
    const { client, worker } = makeClient()
    const first = client.init()
    const firstRequest = worker.posted.at(-1) as { requestId: string }
    worker.emit({ type: 'init:err', requestId: firstRequest.requestId, error: { message: 'database unavailable' } })
    await expect(first).rejects.toThrow('database unavailable')

    const retry = client.init()
    const retryRequest = worker.posted.at(-1) as { requestId: string }
    worker.emit({ type: 'init:ok', requestId: retryRequest.requestId })
    await expect(retry).resolves.toBeUndefined()
  })

  it('bounds initialization with a timeout and clears cached pending state', async () => {
    const { client, worker } = makeClient()
    const first = client.init()
    const firstRejection = expect(first).rejects.toThrow('timed out')
    jest.advanceTimersByTime(RHYME_WORKER_INIT_TIMEOUT_MS)
    await firstRejection

    const retry = client.init()
    expect(worker.posted.filter((message) => (message as { type?: string }).type === 'init')).toHaveLength(2)
    const retryRequest = worker.posted.at(-1) as { requestId: string }
    worker.emit({ type: 'init:ok', requestId: retryRequest.requestId })
    await expect(retry).resolves.toBeUndefined()
  })

  it('returns successful query results unchanged', async () => {
    const { client, worker } = makeClient()
    await initialize(client, worker)
    const promise = beginQuery(client)
    await flush()
    const request = worker.posted.at(-1) as { requestId: string }
    worker.emit({ type: 'getRhymes:ok', requestId: request.requestId, mode: 'perfect', results: { caret: ['rhyme'] } })
    await expect(promise).resolves.toEqual({ results: { caret: ['rhyme'] }, debug: undefined })
  })

  it.each(['crash', 'messageError'] as const)('rejects a pending query on worker %s', async (failure) => {
    const { client, worker } = makeClient()
    await initialize(client, worker)
    const promise = beginQuery(client)
    await flush()
    worker[failure]()
    await expect(promise).rejects.toThrow()
    expect(jest.getTimerCount()).toBe(0)
  })

  it('rejects a query error response', async () => {
    const { client, worker } = makeClient()
    await initialize(client, worker)
    const promise = beginQuery(client)
    await flush()
    const request = worker.posted.at(-1) as { requestId: string }
    worker.emit({ type: 'getRhymes:err', requestId: request.requestId, error: { message: 'query failed' } })
    await expect(promise).rejects.toThrow('query failed')
    expect(jest.getTimerCount()).toBe(0)
  })

  it('rejects a query on timeout and ignores a late response', async () => {
    const { client, worker } = makeClient()
    await initialize(client, worker)
    const promise = beginQuery(client)
    await flush()
    const request = worker.posted.at(-1) as { requestId: string }
    const rejection = expect(promise).rejects.toThrow('timed out')
    jest.advanceTimersByTime(RHYME_WORKER_QUERY_TIMEOUT_MS)
    await rejection
    expect(() => worker.emit({ type: 'getRhymes:ok', requestId: request.requestId, mode: 'perfect', results: { caret: ['late'] } })).not.toThrow()
  })

  it('rejects all pending queries when the worker crashes', async () => {
    const { client, worker } = makeClient()
    await initialize(client, worker)
    const first = beginQuery(client)
    const second = beginQuery(client)
    await flush()
    const firstRejection = expect(first).rejects.toThrow('worker crashed')
    const secondRejection = expect(second).rejects.toThrow('worker crashed')
    worker.crash()
    await Promise.all([firstRejection, secondRejection])
  })

  it('settles initialization when terminated', async () => {
    const { client } = makeClient()
    const promise = client.init()
    client.terminate()
    await expect(promise).rejects.toThrow('terminated')
  })

  it('settles pending queries when terminated', async () => {
    const { client, worker } = makeClient()
    await initialize(client, worker)
    const promise = beginQuery(client)
    await flush()
    client.terminate()
    await expect(promise).rejects.toThrow('terminated')
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })
})
