import { expect, test } from '@playwright/test'

test.describe('Autosave status indicator', () => {
  test('shows active tab spinner only while saving', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#lyric-editor')

    const spinner = page.getByTestId('active-tab-save-spinner')
    await expect(spinner).toHaveCSS('opacity', '0')

    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.type('test')

    await expect(spinner).toHaveCSS('opacity', '0.85')
    await expect(spinner).toHaveCSS('opacity', '0', { timeout: 3000 })
  })
})
