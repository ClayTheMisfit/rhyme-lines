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

  it('defaults new users to All when no saved preference exists', () => {
    useRhymeHighlightSettingsStore.getState().hydrate()
    const state = useRhymeHighlightSettingsStore.getState()

    expect(state.showInternalRhymes).toBe(true)
    expect(state.highlightStopwords).toBe(false)
    expect(state.highlightMode).toBe('all')
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

    expect(state.highlightMode).toBe('all')
    expect(state.showInternalRhymes).toBe(false)
    expect(state.highlightStopwords).toBe(false)
    expect(state.hideColorfulWords).toBe(false)
  })

  it('does not overwrite an existing saved user highlight mode with the All default', () => {
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

  it('merges partial values with defaults', () => {
    localStorage.setItem(
      RHYME_HIGHLIGHT_STORAGE_KEY,
      JSON.stringify({ hideColorfulWords: true })
    )

    useRhymeHighlightSettingsStore.getState().hydrate()
    const state = useRhymeHighlightSettingsStore.getState()

    expect(state.hideColorfulWords).toBe(true)
    expect(state.highlightMode).toBe('all')
    expect(state.showInternalRhymes).toBe(true)
    expect(state.highlightStopwords).toBe(false)
  })
})
