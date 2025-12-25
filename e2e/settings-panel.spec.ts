import { expect, test } from '@playwright/test'

test.describe('Settings panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#lyric-editor')
  })

  test('allows interaction and closes via button, escape, and backdrop', async ({ page }) => {
    const settingsButton = page.getByTestId('settings-trigger')

    await settingsButton.click()
    const dialog = page.getByTestId('settings-panel')
    await expect(dialog).toBeVisible()

    const autoRefreshToggle = dialog.getByTestId('settings-auto-refresh')
    const initialChecked = await autoRefreshToggle.isChecked()
    await autoRefreshToggle.click()
    await expect(autoRefreshToggle).toHaveJSProperty('checked', !initialChecked)

    await dialog.getByTestId('settings-close').click()
    await expect(dialog).toBeHidden()

    await settingsButton.click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await settingsButton.click()
    await expect(dialog).toBeVisible()
    await page.getByTestId('settings-overlay').click()
    await expect(dialog).toBeHidden()
  })
})
