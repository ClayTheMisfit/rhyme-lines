import { resolveTheme } from '@/lib/theme/resolveTheme'
import { readWithMigrations } from '@/lib/persist/storage'

describe('hydration guardrails', () => {
  it('provides a deterministic fallback for system theme during SSR', () => {
    const originalWindow = (global as unknown as { window?: unknown }).window
    // @ts-expect-error intentional SSR simulation
    delete (global as unknown as { window?: unknown }).window

    expect(resolveTheme('system', { hydrated: false })).toBe('dark')

    ;(global as unknown as { window?: unknown }).window = originalWindow
  })

  it('avoids storage access when window is unavailable', () => {
    const originalWindow = (global as unknown as { window?: unknown }).window
    // @ts-expect-error intentional SSR simulation
    delete (global as unknown as { window?: unknown }).window

    expect(() => readWithMigrations('settings')).not.toThrow()
    const result = readWithMigrations('settings')
    expect(result.data).toBeDefined()

    ;(global as unknown as { window?: unknown }).window = originalWindow
  })
})
