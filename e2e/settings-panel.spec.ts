import { expect, test } from '@playwright/test'

const SETTINGS_STORAGE_KEY = 'rhyme-lines:persist:settings'

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
    await dialog.getByText('Auto refresh while typing').click()
    await expect(autoRefreshToggle).toHaveJSProperty('checked', !initialChecked)

    const fontSizeSlider = dialog.locator('#font-size-slider')
    const initialFontSize = Number(await fontSizeSlider.inputValue())
    const nextFontSize = initialFontSize < 28 ? initialFontSize + 1 : initialFontSize - 1

    await fontSizeSlider.evaluate((node, value) => {
      const slider = node as HTMLInputElement
      slider.value = String(value)
      slider.dispatchEvent(new Event('input', { bubbles: true }))
      slider.dispatchEvent(new Event('change', { bubbles: true }))
    }, nextFontSize)

    await expect(fontSizeSlider).toHaveJSProperty('value', String(nextFontSize))
    await expect(dialog.locator('label[for="font-size-slider"]')).toHaveText(`${nextFontSize} px`)

    await expect.poll(async () => {
      const raw = await page.evaluate((key) => localStorage.getItem(key), SETTINGS_STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as { data?: { fontSize?: number; rhymeAutoRefresh?: boolean } }
      return {
        fontSize: parsed.data?.fontSize,
        rhymeAutoRefresh: parsed.data?.rhymeAutoRefresh,
      }
    }).toEqual({
      fontSize: nextFontSize,
      rhymeAutoRefresh: !initialChecked,
    })

    const resetButton = dialog.getByRole('button', { name: 'Reset to defaults' })
    const resetBounds = await resetButton.boundingBox()
    if (!resetBounds) {
      throw new Error('Missing reset button bounds for settings panel')
    }
    await page.mouse.click(
      resetBounds.x + resetBounds.width / 2,
      resetBounds.y + resetBounds.height / 2
    )
    await expect(fontSizeSlider).toHaveJSProperty('value', '18')

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
