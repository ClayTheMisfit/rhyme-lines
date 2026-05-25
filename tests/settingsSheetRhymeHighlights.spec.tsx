import { render, screen } from '@testing-library/react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import {
  RHYME_HIGHLIGHT_DEFAULTS,
  RHYME_HIGHLIGHT_STORAGE_KEY,
} from '@/lib/settings/rhymeHighlightSettings'
import { useRhymeHighlightSettingsStore } from '@/store/rhymeHighlightSettingsStore'

const resetRhymeHighlightStore = () => {
  localStorage.clear()
  useRhymeHighlightSettingsStore.setState({
    ...RHYME_HIGHLIGHT_DEFAULTS,
    hydrated: false,
  })
}

describe('SettingsSheet rhyme highlight mode controls', () => {
  beforeEach(() => {
    resetRhymeHighlightStore()
  })

  it('shows All as the active highlight mode for a new user', () => {
    useRhymeHighlightSettingsStore.getState().hydrate()

    render(<SettingsSheet open onOpenChange={jest.fn()} hideTrigger />)

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'End' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Focus' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the persisted highlight mode as active instead of the All default', () => {
    localStorage.setItem(
      RHYME_HIGHLIGHT_STORAGE_KEY,
      JSON.stringify({
        ...RHYME_HIGHLIGHT_DEFAULTS,
        highlightMode: 'end',
      })
    )
    useRhymeHighlightSettingsStore.getState().hydrate()

    render(<SettingsSheet open onOpenChange={jest.fn()} hideTrigger />)

    expect(screen.getByRole('button', { name: 'End' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
  })
})
