import { expect, test } from '@playwright/test'

test.describe('Editor refactor regressions', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().grantPermissions(['clipboard-write', 'clipboard-read'])
    await page.goto('/')
    await page.waitForSelector('#lyric-editor')
  })

  test('typing does not jump caret', async ({ page }) => {
    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.pressSequentially(['h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'l', 'd'].join(''))
    await editor.press('ArrowLeft')
    await editor.press('ArrowLeft')
    await editor.pressSequentially(['X'].join(''))

    const text = await editor.textContent()
    expect(text).toContain('hello worXld')
  })

  test('paste large block then type', async ({ page }) => {
    const editor = page.locator('#lyric-editor')
    await editor.click()
    const block = Array.from({ length: 120 }, (_, i) => `line ${i + 1}`).join('\n')
    await page.evaluate(async (value) => {
      const text = value as string
      await navigator.clipboard.writeText(text)
    }, block)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V')
    await editor.press('Enter')
    await editor.pressSequentially('end')

    await expect(editor).toContainText('line 120')
    await expect(editor).toContainText('end')
  })

  test('selection persists through overlay updates', async ({ page }) => {
    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.pressSequentially(['s', 'e', 'l', 'e', 'c', 't', ' ', 't', 'h', 'i', 's', ' ', 'p', 'h', 'r', 'a', 's', 'e'].join(''))

    await page.keyboard.down('Shift')
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('ArrowLeft')
    }
    await page.keyboard.up('Shift')

    await page.evaluate(() => {
      window.dispatchEvent(new Event('rhyme:recompute'))
    })

    const selectedText = await page.evaluate(() => window.getSelection()?.toString() ?? '')
    expect(selectedText.length).toBeGreaterThan(0)
  })
})
