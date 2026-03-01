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

  it('uses defaults when key is missing', () => {
    useRhymeHighlightSettingsStore.getState().hydrate()
    const state = useRhymeHighlightSettingsStore.getState()

    expect(state.showInternalRhymes).toBe(true)
    expect(state.highlightStopwords).toBe(false)
    expect(state.highlightMode).toBe('focus')
    expect(state.hideColorfulWords).toBe(false)
  })

  it('persists and restores settings', () => {
    const store = useRhymeHighlightSettingsStore.getState()
    store.setHighlightMode('all')
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

    expect(restored.highlightMode).toBe('all')
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

  it('falls back to default mode for invalid highlightMode', () => {
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

  it('merges partial values with defaults', () => {
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
