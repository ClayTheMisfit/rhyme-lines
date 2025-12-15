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

    const gutterRows = page.locator('[data-line-totals-gutter] div')
    await expect(gutterRows).toHaveCount(3)
    await expect(gutterRows.nth(2)).toHaveText('2')

    const positions = await gutterRows.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().y)
    )

    expect(positions[2]).toBeGreaterThan(positions[0])
  })
})
