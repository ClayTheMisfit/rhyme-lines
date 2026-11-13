import {
  getVersionHistoryRetryDelay,
  HistoryCheckpointScheduler,
  VERSION_HISTORY_INACTIVITY_MS,
  VERSION_HISTORY_MAX_RETRIES,
} from '@/lib/cloud-sync/historyScheduler'
import { requestHistoryCheckpoint } from '@/lib/cloud-sync/client'
import { getAuthoritativeDraftCollection, initializeDraftPersistence, resetDraftPersistenceForTests } from '@/lib/persist/draftCoordinator'
import { createDefaultDraftCollection } from '@/lib/persist/schema'

describe('version history checkpoint scheduler', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('coalesces 100 rapid accepted updates into one checkpoint after inactivity', () => {
    const scheduler = new HistoryCheckpointScheduler()
    const checkpoint = jest.fn(() => ({ outcome: 'success' as const }))
    for (let revision = 1; revision <= 100; revision += 1) {
      scheduler.schedule('document-a', revision, checkpoint)
      jest.advanceTimersByTime(100)
    }
    expect(checkpoint).not.toHaveBeenCalled()
    jest.advanceTimersByTime(VERSION_HISTORY_INACTIVITY_MS)
    expect(checkpoint).toHaveBeenCalledTimes(1)
    expect(checkpoint).toHaveBeenCalledWith(100)
  })

  it('keeps independent document timers and supports cancellation', () => {
    const scheduler = new HistoryCheckpointScheduler()
    const checkpoint = jest.fn(() => ({ outcome: 'success' as const }))
    scheduler.schedule('document-a', 4, checkpoint)
    scheduler.schedule('document-b', 7, checkpoint)
    scheduler.cancel('document-a')
    jest.advanceTimersByTime(VERSION_HISTORY_INACTIVITY_MS)
    expect(checkpoint).toHaveBeenCalledTimes(1)
    expect(checkpoint).toHaveBeenCalledWith(7)
  })

  it('retries failed checkpoints with bounded backoff until they succeed', async () => {
    const scheduler = new HistoryCheckpointScheduler()
    const checkpoint = jest.fn()
      .mockResolvedValueOnce({ outcome: 'retry' })
      .mockResolvedValueOnce({ outcome: 'retry' })
      .mockResolvedValueOnce({ outcome: 'success' })

    scheduler.schedule('document-a', 8, checkpoint)
    await jest.advanceTimersByTimeAsync(VERSION_HISTORY_INACTIVITY_MS)
    expect(checkpoint).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(getVersionHistoryRetryDelay(1))
    expect(checkpoint).toHaveBeenCalledTimes(2)
    await jest.advanceTimersByTimeAsync(getVersionHistoryRetryDelay(2))
    expect(checkpoint).toHaveBeenCalledTimes(3)
    await jest.advanceTimersByTimeAsync(60_000)
    expect(checkpoint).toHaveBeenCalledTimes(3)
  })

  it('retries a rejected checkpoint without leaking an unhandled failure', async () => {
    const scheduler = new HistoryCheckpointScheduler()
    const checkpoint = jest.fn()
      .mockRejectedValueOnce(new Error('transport failed'))
      .mockResolvedValueOnce({ outcome: 'success' })

    scheduler.schedule('document-a', 8, checkpoint)
    await jest.advanceTimersByTimeAsync(VERSION_HISTORY_INACTIVITY_MS)
    await jest.advanceTimersByTimeAsync(getVersionHistoryRetryDelay(1))

    expect(checkpoint).toHaveBeenCalledTimes(2)
  })

  it('stops after the retry limit and lets a newer revision supersede stale work', async () => {
    const scheduler = new HistoryCheckpointScheduler()
    const failed = jest.fn().mockResolvedValue({ outcome: 'retry' })
    const current = jest.fn().mockResolvedValue({ outcome: 'success' })

    scheduler.schedule('document-a', 8, failed)
    await jest.advanceTimersByTimeAsync(VERSION_HISTORY_INACTIVITY_MS)
    scheduler.schedule('document-a', 9, current)
    await jest.advanceTimersByTimeAsync(60_000)
    expect(failed).toHaveBeenCalledTimes(1)
    expect(current).toHaveBeenCalledTimes(1)
    expect(current).toHaveBeenCalledWith(9)

    scheduler.schedule('document-b', 4, failed)
    await jest.advanceTimersByTimeAsync(VERSION_HISTORY_INACTIVITY_MS)
    for (let attempt = 1; attempt <= VERSION_HISTORY_MAX_RETRIES; attempt += 1) {
      await jest.advanceTimersByTimeAsync(getVersionHistoryRetryDelay(attempt))
    }
    expect(failed).toHaveBeenCalledTimes(VERSION_HISTORY_MAX_RETRIES + 2)
    await jest.advanceTimersByTimeAsync(60_000)
    expect(failed).toHaveBeenCalledTimes(VERSION_HISTORY_MAX_RETRIES + 2)
  })

  it('treats checkpoint transport failure as non-blocking for canonical local state', async () => {
    jest.useRealTimers()
    resetDraftPersistenceForTests()
    const collection = createDefaultDraftCollection()
    initializeDraftPersistence(collection, { allowPersistence: true, alreadyPersisted: true })
    const fetchMock = jest.fn(async () => { throw new Error('history unavailable') })
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock })

    await expect(requestHistoryCheckpoint('cloud-1', 8)).resolves.toEqual({ outcome: 'retry' })
    expect(getAuthoritativeDraftCollection()).toEqual(collection)
  })

  it('uses backend retry guidance and stops on terminal checkpoint responses', async () => {
    jest.useRealTimers()
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: { get: (name: string) => name === 'Retry-After' ? '7' : null },
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 409, headers: { get: () => null } } as unknown as Response)
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock })

    await expect(requestHistoryCheckpoint('cloud-1', 8)).resolves.toEqual({
      outcome: 'retry',
      retryAfterMs: 7_000,
    })
    await expect(requestHistoryCheckpoint('cloud-1', 8)).resolves.toEqual({ outcome: 'stop' })
  })
})
