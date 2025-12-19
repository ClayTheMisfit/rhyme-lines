import { expect, test } from '@playwright/test'

test.describe('Editor typing regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#lyric-editor')
  })

  test('keystrokes stay on the same line and backspace removes characters', async ({ page }) => {
    const editor = page.locator('#lyric-editor')
    await editor.click()

    await editor.type('abc')
    await expect(editor).toHaveText('abc')

    const lineCount = await editor.evaluate((node) => node.querySelectorAll('.line').length)
    expect(lineCount).toBe(1)

    await editor.press('Backspace')
    await editor.press('Backspace')

    await expect(editor).toHaveText('a')
    const textContent = await editor.evaluate((node) => node.textContent)
    expect(textContent).toBe('a')
  })
})
