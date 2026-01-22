export type RhymeSource = 'local' | 'online'

export type LocalInitStatus = 'unknown' | 'ready' | 'failed'

type PersistedState = {
  localInitStatus: LocalInitStatus
  localInitFailureReason: string | null
}

const STORAGE_KEY = 'rhyme-lines:rhyme-source'

let localInitStatus: LocalInitStatus = 'unknown'
let localInitFailureReason: string | null = null
let hydrated = false

const hydrate = () => {
  if (hydrated) return
  hydrated = true
  if (typeof window === 'undefined') return
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as PersistedState
    if (parsed.localInitStatus) {
      localInitStatus = parsed.localInitStatus
    }
    localInitFailureReason = parsed.localInitFailureReason ?? null
  } catch {
    localInitStatus = 'unknown'
    localInitFailureReason = null
  }
}

const persist = () => {
  if (typeof window === 'undefined') return
  try {
    const payload: PersistedState = {
      localInitStatus,
      localInitFailureReason,
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage write failures.
  }
}

export const getPreferredRhymeSource = (): RhymeSource => {
  hydrate()
  return localInitStatus === 'failed' ? 'online' : 'local'
}

export const markLocalInitReady = () => {
  hydrate()
  localInitStatus = 'ready'
  localInitFailureReason = null
  persist()
}

export const markLocalInitFailed = (reason?: string) => {
  hydrate()
  localInitStatus = 'failed'
  localInitFailureReason = reason ?? 'Local rhyme DB unavailable'
  persist()
}

export const getLocalInitFailureReason = () => {
  hydrate()
  return localInitFailureReason
}

export const retryLocalInit = () => {
  localInitStatus = 'unknown'
  localInitFailureReason = null
  persist()
}
