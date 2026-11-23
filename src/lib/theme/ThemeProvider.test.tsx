import { act, render, screen } from '@testing-library/react'
import { ThemeProvider, useTheme } from './ThemeProvider'
import { hydrateSettingsStore, useSettingsStore } from '@/store/settingsStore'
import { DEFAULT_SETTINGS } from '@/lib/persist/schema'

function ThemeControls() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme('light')}>Light</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
    hydrateSettingsStore({ ...DEFAULT_SETTINGS, lastUpdatedAt: 1 })
  })

  it('defaults to dark and persists a theme choice', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    })

    render(
      <ThemeProvider>
        <ThemeControls />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    act(() => screen.getByRole('button', { name: 'Light' }).click())
    expect(useSettingsStore.getState().theme).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('restores a persisted system preference', () => {
    window.localStorage.setItem('rhyme-lines:persist:settings', JSON.stringify({
      version: 2,
      data: { ...DEFAULT_SETTINGS, theme: 'system', lastUpdatedAt: 1 },
    }))
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    })

    render(
      <ThemeProvider>
        <ThemeControls />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme')).toHaveTextContent('system')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
  })

  it('updates from the canonical settings store and preserves system mode', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    })

    hydrateSettingsStore({ ...DEFAULT_SETTINGS, theme: 'system', lastUpdatedAt: 1 })
    render(
      <ThemeProvider>
        <ThemeControls />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme')).toHaveTextContent('system')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')

    act(() => useSettingsStore.getState().setTheme('light'))
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
  })

  it('applies canonical settings storage changes from another tab', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    })

    render(
      <ThemeProvider>
        <ThemeControls />
      </ThemeProvider>
    )

    act(() => window.dispatchEvent(new StorageEvent('storage', {
      key: 'rhyme-lines:persist:settings',
      newValue: JSON.stringify({
        version: 2,
        data: { ...DEFAULT_SETTINGS, theme: 'light', lastUpdatedAt: 1 },
      }),
    })))

    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })
})
