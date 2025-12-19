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
    const readGutter = async () => (await gutter.innerText()).split('\n').map((line) => line.trim())

    await expect(editorLines).toHaveCount(3)

    await expect.poll(readGutter).toEqual(['2', '0', '2'])
  })

  test('persists per-line totals after inserting new lines', async ({ page }) => {
    await page.goto('/')

    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.type('spin spin')

    const gutter = page.locator('[data-line-totals-gutter]')
    const readGutter = async () => (await gutter.innerText()).split('\n').map((line) => line.trim())

    await expect.poll(readGutter).toEqual(['2'])

    await editor.press('Enter')

    await expect.poll(readGutter).toEqual(['2', '0'])

    await editor.type('cat')

    await expect.poll(readGutter).toEqual(['2', '1'])
  })
})
