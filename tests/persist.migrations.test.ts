import { migrateDrafts, migrateSettings } from '@/lib/persist/migrations'
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS } from '@/lib/persist/schema'
import { loadPersistedAppState } from '@/lib/persist/appState'
import { useTabsStore } from '@/store/tabsStore'

describe('persistence migrations', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates legacy settings into the current schema', () => {
    const legacySettings = {
      theme: 'light',
      fontSize: 20,
      lineHeight: 1.5,
      rhymeFilters: { perfect: false, near: false, slant: true },
    }

    const { data, version } = migrateSettings([{ key: 'legacy', value: JSON.stringify(legacySettings) }])

    expect(version).toBe(CURRENT_SCHEMA_VERSION)
    expect(data.theme).toBe('light')
    expect(data.fontSize).toBe(20)
    expect(data.rhymeFilters.perfect).toBe(false)
    expect(data.rhymeFilters.near).toBe(true)
    expect(data.lastUpdatedAt).toBeGreaterThan(0)
  })

  it('returns defaults when persisted payload is corrupted', () => {
    const { data, version } = migrateSettings([{ key: 'legacy', value: '{this-is-not-json' }])
    expect(version).toBe(CURRENT_SCHEMA_VERSION)
    expect(data.theme).toBe(DEFAULT_SETTINGS.theme)
    expect(data.rhymeFilters).toEqual(DEFAULT_SETTINGS.rhymeFilters)
  })

  it('migrates legacy drafts preserving line text', () => {
    const legacyDraft = {
      tabs: [
        {
          id: 'draft-1',
          title: 'Test Draft',
          snapshot: { text: 'first line\nsecond line' },
          isDirty: false,
          createdAt: 5,
          updatedAt: 10,
        },
      ],
      activeTabId: 'draft-1',
    }

    const { data, version } = migrateDrafts([{ key: 'legacy', value: JSON.stringify(legacyDraft) }])
    expect(version).toBe(CURRENT_SCHEMA_VERSION)
    expect(data.activeId).toBe('draft-1')
    expect(data.drafts[0]?.lines.map((line) => line.text)).toEqual(['first line', 'second line'])
  })

  it('hydrates the tabs store from a legacy payload in localStorage', () => {
    const legacyDraft = {
      tabs: [
        {
          id: 'draft-1',
          title: 'Migrated Draft',
          snapshot: { text: 'alpha\nbeta' },
          isDirty: false,
          createdAt: 5,
          updatedAt: 10,
        },
      ],
      activeTabId: 'draft-1',
    }
    localStorage.setItem('rhyme-lines.tabs.v1', JSON.stringify(legacyDraft))

    const persisted = loadPersistedAppState()
    const { actions } = useTabsStore.getState()
    actions.hydrate(persisted.drafts)

    const state = useTabsStore.getState()
    expect(state.activeTabId).toBe('draft-1')
    expect(state.tabs[0]?.snapshot.text).toBe('alpha\nbeta')
  })
})
