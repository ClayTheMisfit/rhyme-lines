import { expect, test } from '@playwright/test'

test.describe('Editor empty paste flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#lyric-editor')
  })

  test('click then paste into empty editor clears visual placeholder and triggers analysis', async ({ page }) => {
    const editor = page.locator('#lyric-editor')

    await expect(editor).toHaveAttribute('data-empty', 'true')
    await editor.click()

    await editor.evaluate((element) => {
      const target = element as HTMLDivElement
      const dt = new DataTransfer()
      dt.setData('text/plain', 'line one\nline two')
      target.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
    })

    await expect(editor).toHaveAttribute('data-empty', 'false')
    await expect(editor).toContainText('line one')
    await expect(editor).toContainText('line two')
    // This is a DOM-placeholder guard (not a visual check): visual empty-state is verified by the data-empty flip above.
    await expect(editor).not.toContainText('Start writing…')

    await expect.poll(async () => page.locator('.syllable-badge').count()).toBeGreaterThan(0)
  })

  test('rich-text paste inserts plain text only', async ({ page }) => {
    const editor = page.locator('#lyric-editor')
    await editor.click()

    await editor.evaluate((element) => {
      const target = element as HTMLDivElement
      const dt = new DataTransfer()
      dt.setData('text/plain', 'alpha beta')
      dt.setData('text/html', '<b>alpha</b> <span style="color:red">beta</span>')
      target.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
    })

    await expect(editor).toContainText('alpha beta')
    const richNodes = await editor.evaluate((element) =>
      element.querySelectorAll('b,strong,span[style],font').length
    )
    expect(richNodes).toBe(0)
  })
})
