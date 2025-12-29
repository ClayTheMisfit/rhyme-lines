import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import SettingsSheet from '@/components/settings/SettingsSheet'
import { useSettingsStore } from '@/store/settingsStore'

const setRhymeAutoRefresh = (value: boolean) => {
  useSettingsStore.setState((state) => ({
    ...state,
    rhymeAutoRefresh: value,
  }))
}

describe('SettingsSheet dialog', () => {
  beforeEach(() => {
    setRhymeAutoRefresh(true)
  })

  test('opens, toggles a control, and closes via close button', async () => {
    const user = userEvent.setup()
    render(<SettingsSheet />)

    await user.click(screen.getByTestId('settings-trigger'))
    const dialog = screen.getByTestId('settings-panel')
    expect(dialog).toBeInTheDocument()

    const toggle = screen.getByTestId('settings-auto-refresh') as HTMLInputElement
    expect(toggle.checked).toBe(true)
    await user.click(toggle)
    expect(toggle.checked).toBe(false)

    await user.click(screen.getByTestId('settings-close'))
    await waitFor(() => {
      expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument()
    })
  })

  test('closes via Escape key', async () => {
    const user = userEvent.setup()
    render(<SettingsSheet />)

    await user.click(screen.getByTestId('settings-trigger'))
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument()
    })
  })
})
