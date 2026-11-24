'use client'

export const VERSION_HISTORY_INACTIVITY_MS = 60_000
export const VERSION_HISTORY_MAX_RETRIES = 3
export const VERSION_HISTORY_RETRY_BASE_MS = 5_000
export const VERSION_HISTORY_RETRY_MAX_MS = 30_000

export const getVersionHistoryRetryDelay = (attempt: number) =>
  Math.min(VERSION_HISTORY_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), VERSION_HISTORY_RETRY_MAX_MS)

export type HistoryCheckpointAttemptResult =
  | { outcome: 'success' | 'stop' }
  | { outcome: 'retry'; retryAfterMs?: number }

type Checkpoint = (revision: number) => HistoryCheckpointAttemptResult | Promise<HistoryCheckpointAttemptResult>

export class HistoryCheckpointScheduler {
  private timers = new Map<string, number>()
  private generations = new Map<string, number>()
  private nextGeneration = 0

  schedule(key: string, expectedRevision: number, checkpoint: Checkpoint) {
    this.cancel(key)
    const generation = ++this.nextGeneration
    this.generations.set(key, generation)
    this.scheduleAttempt(key, generation, expectedRevision, checkpoint, 0, VERSION_HISTORY_INACTIVITY_MS)
  }

  private scheduleAttempt(
    key: string,
    generation: number,
    expectedRevision: number,
    checkpoint: Checkpoint,
    attempt: number,
    delay: number
  ) {
    const timer = window.setTimeout(async () => {
      if (this.generations.get(key) !== generation) return
      this.timers.delete(key)
      let result: HistoryCheckpointAttemptResult = { outcome: 'retry' }
      try {
        result = await checkpoint(expectedRevision)
      } catch {
        result = { outcome: 'retry' }
      }
      if (this.generations.get(key) !== generation) return
      if (result.outcome !== 'retry' || attempt >= VERSION_HISTORY_MAX_RETRIES) {
        this.generations.delete(key)
        return
      }
      const nextAttempt = attempt + 1
      this.scheduleAttempt(
        key,
        generation,
        expectedRevision,
        checkpoint,
        nextAttempt,
        Math.max(result.retryAfterMs ?? 0, getVersionHistoryRetryDelay(nextAttempt))
      )
    }, delay)
    this.timers.set(key, timer)
  }

  cancel(key: string) {
    const timer = this.timers.get(key)
    if (timer !== undefined) window.clearTimeout(timer)
    this.timers.delete(key)
    this.generations.delete(key)
  }

  clear() {
    for (const timer of this.timers.values()) window.clearTimeout(timer)
    this.timers.clear()
    this.generations.clear()
  }
}
