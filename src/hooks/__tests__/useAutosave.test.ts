import { act, renderHook } from '@testing-library/react'
import { useAutosave } from '@/hooks/useAutosave'
import {
  getAuthoritativeDraftCollection,
  getDraftPersistenceSnapshot,
  initializeDraftPersistence,
  replaceAuthoritativeDraftCollection,
  resetDraftPersistenceForTests,
} from '@/lib/persist/draftCoordinator'
import { CURRENT_SCHEMA_VERSION, STORAGE_KEYS, createDefaultDraftCollection } from '@/lib/persist/schema'
import { useAutosaveStore } from '@/store/autosaveStore'

const editAuthoritativeText = (text: string) => {
  const current = getAuthoritativeDraftCollection()
  replaceAuthoritativeDraftCollection({
    ...current,
    drafts: current.drafts.map((draft, index) => index === 0 ? {
      ...draft,
      updatedAt: draft.updatedAt + 1,
      lines: [{ ...draft.lines[0], text }],
    } : draft),
  })
}

const readStoredText = (): string | undefined => {
  const raw = localStorage.getItem(STORAGE_KEYS.drafts)
  if (!raw) return undefined
  const stored = JSON.parse(raw) as {
    version: number
    data: { drafts: Array<{ lines: Array<{ text: string }> }> }
  }
  expect(stored.version).toBe(CURRENT_SCHEMA_VERSION)
  return stored.data.drafts[0]?.lines[0]?.text
}

describe('useAutosave acknowledged persistence state', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()
    resetDraftPersistenceForTests()
    initializeDraftPersistence(createDefaultDraftCollection(), {
      allowPersistence: true,
      alreadyPersisted: true,
    })
    useAutosaveStore.setState({
      rev: 0,
      savedRev: 0,
      isSaving: false,
      lastError: null,
      status: 'saved',
      lastSavedAt: null,
      lastErrorAt: null,
      runSave: null,
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    resetDraftPersistenceForTests()
    jest.useRealTimers()
  })

  it('becomes dirty immediately when the authoritative revision changes', () => {
    renderHook(() => useAutosave({ debounceMs: 10 }))

    act(() => editAuthoritativeText('pending edit'))

    const state = useAutosaveStore.getState()
    expect(state.status).toBe('dirty')
    expect(state.rev).toBeGreaterThan(state.savedRev)
    expect(state.lastSavedAt).toBeNull()
  })

  it('reports saved only after a successful coordinator acknowledgement', () => {
    const { result } = renderHook(() => useAutosave({ debounceMs: 10 }))
    act(() => {
      editAuthoritativeText('acknowledged edit')
      result.current.markTextChanged()
      jest.advanceTimersByTime(11)
    })

    const state = useAutosaveStore.getState()
    expect(state.status).toBe('saved')
    expect(state.savedRev).toBe(state.rev)
    expect(state.lastSavedAt).not.toBeNull()
    expect(readStoredText()).toBe('acknowledged edit')
  })

  it('persists the latest revision when rapid edits share one timer', () => {
    const { result } = renderHook(() => useAutosave({ debounceMs: 10 }))
    act(() => {
      editAuthoritativeText('edit 1')
      result.current.markTextChanged()
      editAuthoritativeText('edit 2')
      result.current.markTextChanged()
      editAuthoritativeText('edit 3')
      result.current.markTextChanged()
      jest.advanceTimersByTime(11)
    })

    expect(readStoredText()).toBe('edit 3')
    expect(useAutosaveStore.getState().status).toBe('saved')
  })

  it('keeps the newest revision unacknowledged when storage fails', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    const { result } = renderHook(() => useAutosave({ debounceMs: 10 }))
    act(() => {
      editAuthoritativeText('retry this edit')
      result.current.markTextChanged()
      jest.advanceTimersByTime(11)
    })

    const state = useAutosaveStore.getState()
    expect(state.status).toBe('error')
    expect(state.savedRev).toBeLessThan(state.rev)
    expect(getDraftPersistenceSnapshot().acknowledgedRevision).toBeLessThan(
      getDraftPersistenceSnapshot().currentRevision
    )
  })

  it('recovers from a failed write when a later flush succeeds', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    const { result } = renderHook(() => useAutosave({ debounceMs: 10 }))
    act(() => {
      editAuthoritativeText('eventual success')
      result.current.markTextChanged()
      jest.advanceTimersByTime(11)
    })
    expect(useAutosaveStore.getState().status).toBe('error')

    setItem.mockRestore()
    act(() => result.current.runSave())

    expect(useAutosaveStore.getState().status).toBe('saved')
    expect(readStoredText()).toBe('eventual success')
  })

  it('flushes the latest authoritative revision when the autosave owner unmounts', () => {
    const { unmount } = renderHook(() => useAutosave({ debounceMs: 10_000 }))
    act(() => editAuthoritativeText('UNFLUSHED EDIT SENTINEL'))

    unmount()

    expect(readStoredText()).toBe('UNFLUSHED EDIT SENTINEL')
  })

  it('flushes once across duplicate browser lifecycle signals', () => {
    renderHook(() => useAutosave({ debounceMs: 10_000 }))
    act(() => editAuthoritativeText('PAGEHIDE EDIT SENTINEL'))
    const setItem = jest.spyOn(Storage.prototype, 'setItem')

    act(() => {
      window.dispatchEvent(new Event('pagehide'))
      window.dispatchEvent(new Event('beforeunload'))
    })

    expect(readStoredText()).toBe('PAGEHIDE EDIT SENTINEL')
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('does not bypass the hydration gate during lifecycle cleanup', () => {
    localStorage.setItem(STORAGE_KEYS.drafts, '7')
    resetDraftPersistenceForTests()
    initializeDraftPersistence(createDefaultDraftCollection(), { allowPersistence: false })
    const { unmount } = renderHook(() => useAutosave({ debounceMs: 10_000 }))

    unmount()

    expect(localStorage.getItem(STORAGE_KEYS.drafts)).toBe('7')
    expect(getDraftPersistenceSnapshot().status).toBe('error')
  })
})
