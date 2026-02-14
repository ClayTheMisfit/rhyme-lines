import { expect, test } from '@playwright/test'

test.describe('Autosave status indicator', () => {
  test('shows saved state after debounce', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#lyric-editor')

    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible()

    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.type('test')

    await expect(page.getByRole('button', { name: 'Saving…' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 3000 })
  })
})
