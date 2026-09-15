'use client'

export const VERSION_HISTORY_INACTIVITY_MS = 60_000

export class HistoryCheckpointScheduler {
  private timers = new Map<string, number>()

  schedule(key: string, expectedRevision: number, checkpoint: (revision: number) => void) {
    this.cancel(key)
    this.timers.set(key, window.setTimeout(() => {
      this.timers.delete(key)
      checkpoint(expectedRevision)
    }, VERSION_HISTORY_INACTIVITY_MS))
  }

  cancel(key: string) {
    const timer = this.timers.get(key)
    if (timer !== undefined) window.clearTimeout(timer)
    this.timers.delete(key)
  }

  clear() {
    for (const timer of this.timers.values()) window.clearTimeout(timer)
    this.timers.clear()
  }
}
