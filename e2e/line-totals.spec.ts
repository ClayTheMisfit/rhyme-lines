import { expect, test } from '@playwright/test'

test.describe('Line totals gutter', () => {
  test('renders totals after blank lines', async ({ page }) => {
    await page.goto('/')

    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.type('spin test')
    await editor.press('Enter')
    await editor.press('Enter')
    await editor.type('spin test')

    const gutter = page.locator('[data-line-totals-gutter]')
    const editorLines = page.locator('.rl-editor .line')

    await expect(editorLines).toHaveCount(3)

    const gutterLines = (await gutter.innerText()).split('\n')

    expect(gutterLines).toHaveLength(3)
    expect(gutterLines[gutterLines.length - 1].trim()).toBe('2')
  })
})
