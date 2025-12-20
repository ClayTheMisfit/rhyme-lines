export type DebounceMode = 'typing' | 'caret'

const TYPING_DELAY = 250
const CARET_DELAY = 50

export function getDebounceDelay(mode: DebounceMode) {
  return mode === 'typing' ? TYPING_DELAY : CARET_DELAY
}

export class DebounceOwner {
  private timers = new Map<DebounceMode, number>()

  schedule(mode: DebounceMode, fn: () => void) {
    const existing = this.timers.get(mode)
    if (existing) {
      clearTimeout(existing)
    }

    const timer = window.setTimeout(() => {
      this.timers.delete(mode)
      fn()
    }, getDebounceDelay(mode))

    this.timers.set(mode, timer)
  }

  cancelAll() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }
}
