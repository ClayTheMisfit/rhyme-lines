import { loadPersistedAppState } from '@/lib/persist/appState'
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  type DraftCollection,
} from '@/lib/persist/schema'
import { hydrateTabsFromPersisted, useTabsStore } from '@/store/tabsStore'

const SENTINEL = 'DO NOT LOSE THIS LYRIC'

const persistedDrafts = (): DraftCollection => ({
  drafts: [
    {
      docId: 'protected-draft',
      title: 'Protected',
      createdAt: 1,
      updatedAt: 2,
      lines: [{ id: 'protected-line', text: SENTINEL }],
    },
  ],
  activeId: 'protected-draft',
  folders: [],
})

const seedDrafts = () => {
  localStorage.setItem(
    STORAGE_KEYS.drafts,
    JSON.stringify({ version: CURRENT_SCHEMA_VERSION, data: persistedDrafts() })
  )
}

const storedLyric = () => {
  const raw = localStorage.getItem(STORAGE_KEYS.drafts)
  if (!raw) return null
  const parsed = JSON.parse(raw) as { data?: DraftCollection }
  return parsed.data?.drafts[0]?.lines[0]?.text ?? null
}

describe('persistence data-loss guardrails', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()
    hydrateTabsFromPersisted(persistedDrafts(), { allowPersistence: true })
    jest.clearAllTimers()
    localStorage.clear()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.restoreAllMocks()
    jest.useRealTimers()
    localStorage.clear()
  })

  it('loads valid lyrics when storage is readable but writes fail', () => {
    seedDrafts()
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    const result = loadPersistedAppState()

    expect(result.drafts.drafts[0]?.lines[0]?.text).toBe(SENTINEL)
  })

  it('isolates a primitive panel payload from valid persisted drafts', () => {
    seedDrafts()
    localStorage.setItem(STORAGE_KEYS.panel, '7')

    const result = loadPersistedAppState()

    expect(result.drafts.drafts[0]?.lines[0]?.text).toBe(SENTINEL)
    expect(result.panel.rhymePanel.isOpen).toBe(false)
    expect(result.hydration.drafts).toBe('ok')
    expect(result.hydration.panel).toBe('invalid')
  })

  it('does not overwrite recoverable lyrics after failed hydration when writes return', () => {
    seedDrafts()
    const readFailure = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError')
    })

    const result = loadPersistedAppState()
    hydrateTabsFromPersisted(result.drafts, {
      allowPersistence: result.hydration.drafts === 'ok' || result.hydration.drafts === 'missing',
    })
    readFailure.mockRestore()
    jest.advanceTimersByTime(300)

    expect(result.hydration.drafts).toBe('unavailable')
    expect(storedLyric()).toBe(SENTINEL)
  })

  it('keeps first-run creation writable when draft storage is genuinely missing', () => {
    const result = loadPersistedAppState()
    hydrateTabsFromPersisted(result.drafts, {
      allowPersistence: result.hydration.drafts === 'ok' || result.hydration.drafts === 'missing',
    })
    jest.advanceTimersByTime(300)

    expect(result.hydration.drafts).toBe('missing')
    expect(localStorage.getItem(STORAGE_KEYS.drafts)).not.toBeNull()
  })

  it('hydrates valid drafts and persists subsequent edits', () => {
    seedDrafts()
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ version: CURRENT_SCHEMA_VERSION, data: { ...DEFAULT_SETTINGS, theme: 'light' } })
    )
    const result = loadPersistedAppState()
    hydrateTabsFromPersisted(result.drafts, {
      allowPersistence: result.hydration.drafts === 'ok' || result.hydration.drafts === 'missing',
    })
    const state = useTabsStore.getState()
    state.actions.updateSnapshot('protected-draft', { text: `${SENTINEL} EDITED` })
    jest.advanceTimersByTime(300)

    expect(result.hydration.drafts).toBe('ok')
    expect(result.settings.theme).toBe('light')
    expect(storedLyric()).toBe(`${SENTINEL} EDITED`)
  })

  it('leaves an invalid draft payload untouched and suppresses replacement persistence', () => {
    localStorage.setItem(STORAGE_KEYS.drafts, '7')

    const result = loadPersistedAppState()
    hydrateTabsFromPersisted(result.drafts, {
      allowPersistence: result.hydration.drafts === 'ok' || result.hydration.drafts === 'missing',
    })
    jest.advanceTimersByTime(300)

    expect(result.hydration.drafts).toBe('invalid')
    expect(localStorage.getItem(STORAGE_KEYS.drafts)).toBe('7')
  })

  it('keeps a legacy lyric source when writing its migrated replacement fails', () => {
    localStorage.setItem('autosave', SENTINEL)
    const originalSetItem = Storage.prototype.setItem
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === STORAGE_KEYS.drafts) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      return originalSetItem.call(this, key, value)
    })

    const result = loadPersistedAppState()

    expect(result.drafts.drafts[0]?.lines[0]?.text).toBe(SENTINEL)
    expect(localStorage.getItem('autosave')).toBe(SENTINEL)
  })
})
