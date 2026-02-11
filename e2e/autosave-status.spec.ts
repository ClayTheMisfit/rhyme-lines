import { expect, test } from '@playwright/test'

test.describe('Autosave status pill', () => {
  test('shows saved state after debounce', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#lyric-editor')

    await expect(page.getByText('All changes saved')).toBeVisible()

    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.type('test')

    await expect(page.getByText('Unsaved changes')).toBeVisible()
    await expect(page.getByText('All changes saved')).toBeVisible({ timeout: 3000 })
  })
})
