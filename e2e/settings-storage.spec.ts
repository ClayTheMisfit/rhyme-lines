import { expect, test } from '@playwright/test'
import { openProject, seedProjects } from './fixtures/project'

const SETTINGS_KEY = 'rhyme-lines:persist:settings'

test.describe('Settings storage hardening', () => {
  test('invalid settings payload is preserved safely until a valid preference is saved', async ({ page }) => {
    await seedProjects(page, [{ id: 'settings-draft', title: 'Settings Draft' }])
    await page.evaluate((key) => window.localStorage.setItem(key, '{invalid-json'), SETTINGS_KEY)
    await openProject(page, 'settings-draft')

    await expect.poll(async () => {
      return page.evaluate((key) => window.localStorage.getItem(key), SETTINGS_KEY)
    }).toBe('{invalid-json')

    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('button', { name: 'Editor settings' }).click()
    const dialog = page.getByTestId('settings-panel')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Light' }).click()
    await expect.poll(async () => {
      const raw = await page.evaluate((key) => window.localStorage.getItem(key), SETTINGS_KEY)
      if (!raw) return null
      try {
        return (JSON.parse(raw) as { data?: { theme?: string } }).data?.theme
      } catch {
        return null
      }
    }).toBe('light')

    await page.reload()
    await expect(page.locator('#lyric-editor')).toBeVisible()

    await expect.poll(async () => {
      return page.evaluate(() => document.body.classList.contains('bg-white'))
    }).toBe(true)
  })
})
