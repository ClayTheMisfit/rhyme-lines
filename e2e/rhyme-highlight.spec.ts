import { expect, test, type Page } from '@playwright/test'

const openSettings = async (page: Page) => {
  const settingsButton = page.getByTestId('settings-trigger')
  await settingsButton.click()
  return page.getByTestId('settings-panel')
}

test.describe('rhyme highlighting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#lyric-editor')
  })

  test('pastes multi-line text without typing first', async ({ page }) => {
    const editor = page.locator('#lyric-editor')
    await editor.click()

    await page.evaluate(() => {
      const target = document.getElementById('lyric-editor')
      if (!target) throw new Error('Missing editor')
      const data = new DataTransfer()
      data.setData('text/plain', 'Line one\nLine two')
      const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
      target.dispatchEvent(event)
    })

    await expect
      .poll(async () => editor.evaluate((node) => (node as HTMLElement).innerText))
      .toBe('Line one\nLine two')
  })

  test('toggles rhyme highlighting on and off', async ({ page }) => {
    const editor = page.locator('#lyric-editor')
    await editor.click()
    await page.keyboard.insertText('time rhyme time')

    await expect(page.locator('[data-testid="rhyme-pill"]')).toHaveCount(3)

    const panel = await openSettings(page)
    await panel.getByTestId('settings-rhyme-highlight').click()
    await expect(page.locator('[data-testid="rhyme-pill"]')).toHaveCount(0)

    await panel.getByTestId('settings-rhyme-highlight').click()
    await expect(page.locator('[data-testid="rhyme-pill"]')).toHaveCount(3)

    await panel.getByTestId('settings-close').click()
  })

  test('respects ignore stopwords and exact repeat underline toggles', async ({ page }) => {
    const editor = page.locator('#lyric-editor')
    await editor.click()
    await page.keyboard.insertText('the the')

    const panel = await openSettings(page)
    const highlightToggle = panel.getByTestId('settings-rhyme-highlight')
    const ignoreStopwordsToggle = panel.getByTestId('settings-rhyme-stopwords')
    const exactRepeatsToggle = panel.getByTestId('settings-rhyme-repeats')

    if (!(await highlightToggle.isChecked())) {
      await highlightToggle.click()
    }
    if (await ignoreStopwordsToggle.isChecked()) {
      await ignoreStopwordsToggle.click()
    }
    if (!(await exactRepeatsToggle.isChecked())) {
      await exactRepeatsToggle.click()
    }

    await expect(page.locator('[data-testid="rhyme-underline"]')).toHaveCount(2)

    await ignoreStopwordsToggle.click()
    await expect(page.locator('[data-testid="rhyme-underline"]')).toHaveCount(0)

    await exactRepeatsToggle.click()
    await expect(page.locator('[data-testid="rhyme-underline"]')).toHaveCount(0)

    await panel.getByTestId('settings-close').click()
  })
})
