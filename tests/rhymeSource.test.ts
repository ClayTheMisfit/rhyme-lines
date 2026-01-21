import {
  getLocalInitFailureReason,
  getPreferredRhymeSource,
  markLocalInitFailed,
  markLocalInitReady,
  retryLocalInit,
} from '@/lib/rhymes/rhymeSource'

describe('rhymeSource', () => {
  beforeEach(() => {
    sessionStorage.clear()
    retryLocalInit()
  })

  it('defaults to local when status is unknown', () => {
    expect(getPreferredRhymeSource()).toBe('local')
    expect(getLocalInitFailureReason()).toBeNull()
  })

  it('switches to online after a local init failure', () => {
    markLocalInitFailed('missing db')
    expect(getPreferredRhymeSource()).toBe('online')
    expect(getLocalInitFailureReason()).toBe('missing db')
  })

  it('restores local after a successful init', () => {
    markLocalInitFailed('missing db')
    markLocalInitReady()
    expect(getPreferredRhymeSource()).toBe('local')
    expect(getLocalInitFailureReason()).toBeNull()
  })
})
