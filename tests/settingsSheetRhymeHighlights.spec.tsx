import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('shows Focus as the active highlight mode for a new user', () => {
    useRhymeHighlightSettingsStore.getState().hydrate()

    render(<SettingsSheet open onOpenChange={jest.fn()} hideTrigger />)

    expect(screen.getByRole('button', { name: 'Focus' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'End' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the persisted highlight mode as active instead of the Focus default', () => {
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
    expect(screen.getByRole('button', { name: 'Focus' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('allows user to switch from Focus to All and persists the selected mode', async () => {
    const user = userEvent.setup()
    useRhymeHighlightSettingsStore.getState().hydrate()

    render(<SettingsSheet open onOpenChange={jest.fn()} hideTrigger />)

    await user.click(screen.getByRole('button', { name: 'All' }))

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Focus' })).toHaveAttribute('aria-pressed', 'false')
    expect(JSON.parse(localStorage.getItem(RHYME_HIGHLIGHT_STORAGE_KEY) ?? '{}')).toMatchObject({
      highlightMode: 'all',
    })
  })

  it('allows user to switch from All back to Focus and persists the selected mode', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      RHYME_HIGHLIGHT_STORAGE_KEY,
      JSON.stringify({
        ...RHYME_HIGHLIGHT_DEFAULTS,
        highlightMode: 'all',
      })
    )
    useRhymeHighlightSettingsStore.getState().hydrate()

    render(<SettingsSheet open onOpenChange={jest.fn()} hideTrigger />)

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Focus' }))

    expect(screen.getByRole('button', { name: 'Focus' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(JSON.parse(localStorage.getItem(RHYME_HIGHLIGHT_STORAGE_KEY) ?? '{}')).toMatchObject({
      highlightMode: 'focus',
    })
  })
})
