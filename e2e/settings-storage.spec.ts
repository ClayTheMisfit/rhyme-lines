import { expect, test } from '@playwright/test'

const SETTINGS_KEY = 'rhyme-lines:persist:settings'

test.describe('Settings storage hardening', () => {
  test('invalid settings payload self-heals and legacy light theme is ignored', async ({ page }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, '{invalid-json')
    }, SETTINGS_KEY)

    await page.goto('/')
    await page.waitForSelector('#lyric-editor')

    await expect.poll(async () => {
      return page.evaluate((key) => window.localStorage.getItem(key), SETTINGS_KEY)
    }).toBeNull()

    await page.evaluate((key) => {
      window.localStorage.setItem(key, JSON.stringify({ version: 2, data: { theme: 'light', fontSize: 18, lineHeight: 1.6, rhymeFilters: { perfect: true, near: true }, lastUpdatedAt: Date.now() } }))
    }, SETTINGS_KEY)

    await page.reload()
    await page.waitForSelector('#lyric-editor')

    await expect.poll(async () => {
      return page.evaluate(() => document.body.classList.contains('bg-black') && !document.body.classList.contains('bg-white'))
    }).toBe(true)
  })
})
