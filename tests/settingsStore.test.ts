import { applySettingsSnapshot, getCurrentSettingsSnapshot, SETTINGS_DEFAULTS, useSettingsStore } from '@/store/settingsStore'

describe('settings store', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.setState({ ...SETTINGS_DEFAULTS })
  })

  it('initialises with default values', () => {
    const state = useSettingsStore.getState()

    expect(state.theme).toBe(SETTINGS_DEFAULTS.theme)
    expect(state.fontSize).toBe(SETTINGS_DEFAULTS.fontSize)
    expect(state.lineHeight).toBeCloseTo(SETTINGS_DEFAULTS.lineHeight)
    expect(state.badgeSize).toBe(SETTINGS_DEFAULTS.badgeSize)
    expect(state.showLineTotals).toBe(SETTINGS_DEFAULTS.showLineTotals)
    expect(state.rhymeAutoRefresh).toBe(SETTINGS_DEFAULTS.rhymeAutoRefresh)
    expect(state.debounceMode).toBe(SETTINGS_DEFAULTS.debounceMode)
  })

  it('persists updates to localStorage', () => {
    const { setFontSize, setTheme } = useSettingsStore.getState()

    setTheme('light')
    setFontSize(22)

    const raw = localStorage.getItem('rhyme-lines:settings')
    expect(raw).toBeTruthy()

    const parsed = raw ? JSON.parse(raw) : null
    expect(parsed?.state.theme).toBe('light')
    expect(parsed?.state.fontSize).toBe(22)
  })

  it('resets to defaults and can restore snapshots', () => {
    const {
      setTheme,
      setFontSize,
      setLineHeight,
      setBadgeSize,
      setShowLineTotals,
      setRhymeAutoRefresh,
      setDebounceMode,
      resetDefaults,
    } = useSettingsStore.getState()

    setTheme('light')
    setFontSize(24)
    setLineHeight(1.8)
    setBadgeSize('md')
    setShowLineTotals(false)
    setRhymeAutoRefresh(false)
    setDebounceMode('cursor-50')

    const snapshot = getCurrentSettingsSnapshot()

    resetDefaults()

    const stateAfterReset = useSettingsStore.getState()
    expect(stateAfterReset).toMatchObject(SETTINGS_DEFAULTS)

    applySettingsSnapshot(snapshot)

    const restored = useSettingsStore.getState()
    expect(restored.theme).toBe('light')
    expect(restored.fontSize).toBe(24)
    expect(restored.lineHeight).toBeCloseTo(1.8)
    expect(restored.badgeSize).toBe('md')
    expect(restored.showLineTotals).toBe(false)
    expect(restored.rhymeAutoRefresh).toBe(false)
    expect(restored.debounceMode).toBe('cursor-50')
  })
})
