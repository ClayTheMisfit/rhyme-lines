import { expect, test } from '@playwright/test'

const SETTINGS_KEY = 'rhyme-lines:persist:settings'

test.describe('Settings storage hardening', () => {
  test('invalid settings payload self-heals and theme persists', async ({ page }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, '{invalid-json')
    }, SETTINGS_KEY)

    await page.goto('/')
    await page.waitForSelector('#lyric-editor')

    await expect.poll(async () => {
      return page.evaluate((key) => window.localStorage.getItem(key), SETTINGS_KEY)
    }).toBeNull()

    await page.getByTestId('settings-trigger').click()
    const dialog = page.getByTestId('settings-panel')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Light' }).click()

    await page.reload()
    await page.waitForSelector('#lyric-editor')

    await expect.poll(async () => {
      return page.evaluate(() => document.body.classList.contains('bg-white'))
    }).toBe(true)
  })
})
