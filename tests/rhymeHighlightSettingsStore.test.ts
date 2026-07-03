import {
  RHYME_HIGHLIGHT_DEFAULTS,
  RHYME_HIGHLIGHT_STORAGE_KEY,
} from '@/lib/settings/rhymeHighlightSettings'
import { useRhymeHighlightSettingsStore } from '@/store/rhymeHighlightSettingsStore'

describe('rhyme highlight settings store', () => {
  beforeEach(() => {
    localStorage.clear()
    useRhymeHighlightSettingsStore.setState({
      ...RHYME_HIGHLIGHT_DEFAULTS,
      hydrated: false,
    })
  })

  it('uses focus as the default highlight mode for new users', () => {
    useRhymeHighlightSettingsStore.getState().hydrate()
    const state = useRhymeHighlightSettingsStore.getState()

    expect(state.showInternalRhymes).toBe(true)
    expect(state.highlightStopwords).toBe(false)
    expect(state.highlightMode).toBe('focus')
    expect(state.hideColorfulWords).toBe(false)
  })

  it('persists and restores a changed highlight mode preference', () => {
    const store = useRhymeHighlightSettingsStore.getState()
    store.setHighlightMode('end')
    store.setHideColorfulWords(true)
    store.setShowInternalRhymes(false)
    store.setHighlightStopwords(true)

    const raw = localStorage.getItem(RHYME_HIGHLIGHT_STORAGE_KEY)
    expect(raw).toBeTruthy()

    useRhymeHighlightSettingsStore.setState({
      ...RHYME_HIGHLIGHT_DEFAULTS,
      hydrated: false,
    })

    useRhymeHighlightSettingsStore.getState().hydrate()
    const restored = useRhymeHighlightSettingsStore.getState()

    expect(restored.highlightMode).toBe('end')
    expect(restored.hideColorfulWords).toBe(true)
    expect(restored.showInternalRhymes).toBe(false)
    expect(restored.highlightStopwords).toBe(true)
  })

  it('falls back to defaults for corrupt json', () => {
    localStorage.setItem(RHYME_HIGHLIGHT_STORAGE_KEY, '{not-json')

    useRhymeHighlightSettingsStore.getState().hydrate()
    const state = useRhymeHighlightSettingsStore.getState()

    expect(state).toMatchObject(RHYME_HIGHLIGHT_DEFAULTS)
  })

  it('falls back to focus when persisted highlight mode is invalid', () => {
    localStorage.setItem(
      RHYME_HIGHLIGHT_STORAGE_KEY,
      JSON.stringify({
        highlightMode: 'banana',
        showInternalRhymes: false,
      })
    )

    useRhymeHighlightSettingsStore.getState().hydrate()
    const state = useRhymeHighlightSettingsStore.getState()

    expect(state.highlightMode).toBe('focus')
    expect(state.showInternalRhymes).toBe(false)
    expect(state.highlightStopwords).toBe(false)
    expect(state.hideColorfulWords).toBe(false)
  })

  it('preserves persisted all mode when explicitly saved', () => {
    localStorage.setItem(
      RHYME_HIGHLIGHT_STORAGE_KEY,
      JSON.stringify({
        ...RHYME_HIGHLIGHT_DEFAULTS,
        highlightMode: 'all',
      })
    )

    useRhymeHighlightSettingsStore.getState().hydrate()
    const state = useRhymeHighlightSettingsStore.getState()

    expect(state.highlightMode).toBe('all')
    expect(JSON.parse(localStorage.getItem(RHYME_HIGHLIGHT_STORAGE_KEY) ?? '{}')).toMatchObject({
      highlightMode: 'all',
    })
  })

  it('preserves persisted focus mode when explicitly saved', () => {
    localStorage.setItem(
      RHYME_HIGHLIGHT_STORAGE_KEY,
      JSON.stringify({
        ...RHYME_HIGHLIGHT_DEFAULTS,
        highlightMode: 'focus',
      })
    )

    useRhymeHighlightSettingsStore.getState().hydrate()
    const state = useRhymeHighlightSettingsStore.getState()

    expect(state.highlightMode).toBe('focus')
    expect(JSON.parse(localStorage.getItem(RHYME_HIGHLIGHT_STORAGE_KEY) ?? '{}')).toMatchObject({
      highlightMode: 'focus',
    })
  })

  it('hydrates from legacy settings key when v1 key is missing', () => {
    localStorage.setItem(
      'rhyme-lines:persist:settings',
      JSON.stringify({
        data: {
          showInternalRhymes: false,
          highlightStopwords: true,
          rhymeHighlightMode: 'all',
          hideRhymeColors: true,
        },
      })
    )

    expect(localStorage.getItem(RHYME_HIGHLIGHT_STORAGE_KEY)).toBeNull()

    useRhymeHighlightSettingsStore.getState().hydrate()
    const state = useRhymeHighlightSettingsStore.getState()

    expect(state.showInternalRhymes).toBe(false)
    expect(state.highlightStopwords).toBe(true)
    expect(state.highlightMode).toBe('all')
    expect(state.hideColorfulWords).toBe(true)
  })

  it('fills missing highlight mode with focus when persisted settings are partial', () => {
    localStorage.setItem(
      RHYME_HIGHLIGHT_STORAGE_KEY,
      JSON.stringify({ hideColorfulWords: true })
    )

    useRhymeHighlightSettingsStore.getState().hydrate()
    const state = useRhymeHighlightSettingsStore.getState()

    expect(state.hideColorfulWords).toBe(true)
    expect(state.highlightMode).toBe('focus')
    expect(state.showInternalRhymes).toBe(true)
    expect(state.highlightStopwords).toBe(false)
  })
})
