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
    const overlay = page.getByTestId('settings-overlay')
    const overlayBox = await overlay.boundingBox()
    const panelBox = await dialog.boundingBox()

    if (!overlayBox || !panelBox) {
      throw new Error('Missing overlay or panel bounds for settings panel')
    }

    const point = { x: overlayBox.x + 8, y: overlayBox.y + 8 }
    const insidePanel =
      point.x >= panelBox.x &&
      point.x <= panelBox.x + panelBox.width &&
      point.y >= panelBox.y &&
      point.y <= panelBox.y + panelBox.height

    if (insidePanel) {
      point.x = overlayBox.x + overlayBox.width - 8
      point.y = overlayBox.y + 8
    }

    await page.mouse.click(point.x, point.y)
    await expect(dialog).toBeHidden()
  })
})
