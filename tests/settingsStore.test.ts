import { applySettingsSnapshot, getCurrentSettingsSnapshot, SETTINGS_DEFAULTS, useSettingsStore } from '@/store/settingsStore'

describe('settings store', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()
    useSettingsStore.setState((state) => ({
      ...state,
      ...SETTINGS_DEFAULTS,
    }))
  })

  afterEach(() => {
    jest.useRealTimers()
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
    expect(state.highContrast).toBe(SETTINGS_DEFAULTS.highContrast)
  })

  it('persists updates to localStorage', () => {
    const { setFontSize, setTheme } = useSettingsStore.getState()

    setTheme('light')
    setFontSize(22)
    jest.runOnlyPendingTimers()

    const raw = localStorage.getItem('rhyme-lines:persist:settings')
    expect(raw).toBeTruthy()

    const parsed = raw ? JSON.parse(raw) : null
    expect(parsed?.data.theme).toBe('light')
    expect(parsed?.data.fontSize).toBe(22)
    expect(parsed?.version).toBeGreaterThanOrEqual(1)
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
    expect(stateAfterReset.theme).toBe(SETTINGS_DEFAULTS.theme)
    expect(stateAfterReset.fontSize).toBe(SETTINGS_DEFAULTS.fontSize)

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
