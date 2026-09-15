import { HistoryCheckpointScheduler, VERSION_HISTORY_INACTIVITY_MS } from '@/lib/cloud-sync/historyScheduler'
import { requestHistoryCheckpoint } from '@/lib/cloud-sync/client'
import { getAuthoritativeDraftCollection, initializeDraftPersistence, resetDraftPersistenceForTests } from '@/lib/persist/draftCoordinator'
import { createDefaultDraftCollection } from '@/lib/persist/schema'

describe('version history checkpoint scheduler', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('coalesces 100 rapid accepted updates into one checkpoint after inactivity', () => {
    const scheduler = new HistoryCheckpointScheduler()
    const checkpoint = jest.fn()
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
    const checkpoint = jest.fn()
    scheduler.schedule('document-a', 4, checkpoint)
    scheduler.schedule('document-b', 7, checkpoint)
    scheduler.cancel('document-a')
    jest.advanceTimersByTime(VERSION_HISTORY_INACTIVITY_MS)
    expect(checkpoint).toHaveBeenCalledTimes(1)
    expect(checkpoint).toHaveBeenCalledWith(7)
  })

  it('treats checkpoint transport failure as non-blocking for canonical local state', async () => {
    jest.useRealTimers()
    resetDraftPersistenceForTests()
    const collection = createDefaultDraftCollection()
    initializeDraftPersistence(collection, { allowPersistence: true, alreadyPersisted: true })
    const fetchMock = jest.fn(async () => { throw new Error('history unavailable') })
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock })

    await expect(requestHistoryCheckpoint('cloud-1', 8)).resolves.toBe(false)
    expect(getAuthoritativeDraftCollection()).toEqual(collection)
  })
})
