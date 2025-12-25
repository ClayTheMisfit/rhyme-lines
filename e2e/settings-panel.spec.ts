import { expect, test } from '@playwright/test'

test.describe('Settings panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#lyric-editor')
  })

  test('allows interaction and closes via button, escape, and backdrop', async ({ page }) => {
    const settingsButton = page.getByRole('button', { name: 'Open settings' })

    await settingsButton.click()
    const dialog = page.getByRole('dialog', { name: 'Editor settings' })
    await expect(dialog).toBeVisible()

    const autoRefreshToggle = dialog.getByLabel('Auto refresh rhyme suggestions')
    const initialChecked = await autoRefreshToggle.isChecked()
    await autoRefreshToggle.click()
    await expect(autoRefreshToggle).toHaveJSProperty('checked', !initialChecked)

    await dialog.getByRole('button', { name: 'Close settings' }).click()
    await expect(dialog).toBeHidden()

    await settingsButton.click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await settingsButton.click()
    await expect(dialog).toBeVisible()
    await page.getByTestId('settings-backdrop').click()
    await expect(dialog).toBeHidden()
  })
})
