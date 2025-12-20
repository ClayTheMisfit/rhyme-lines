import { expect, test } from '@playwright/test'

test.describe('Rhyme suggestions panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#lyric-editor')
    const toggle = page.getByTitle(/rhyme panel/i)
    const panel = page.locator('[data-testid="rhyme-panel"]')
    if (!(await panel.isVisible())) {
      await toggle.click()
    }
    await expect(panel).toBeVisible()
  })

  test('loads rhyme suggestions for typed query', async ({ page }) => {
    const panel = page.locator('[data-testid="rhyme-panel"]')
    const searchInput = panel.getByPlaceholder('Search')

    await searchInput.fill('day')
    await page.waitForTimeout(400)

    const firstSuggestion = panel.locator('.thin-scrollbar button').first()
    await expect(firstSuggestion).toBeVisible({ timeout: 5000 })
  })

  test('keeps up with rapid caret movement without thrash', async ({ page }) => {
    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.type('one two three four five')

    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowRight')
    }

    const loader = page.getByText('Loading suggestions...')
    await expect(loader).not.toBeVisible({ timeout: 4000 })
    await expect(editor).toContainText('one two three four five')
  })

  test('surfaces provider errors without breaking the editor', async ({ page }) => {
    await page.route('https://api.datamuse.com/**', (route) =>
      route.fulfill({ status: 500, body: 'forced failure' })
    )
    await page.route('https://rhymebrain.com/**', (route) =>
      route.fulfill({ status: 500, body: 'forced failure' })
    )

    const panel = page.locator('[data-testid="rhyme-panel"]')
    const searchInput = panel.getByPlaceholder('Search')
    await searchInput.fill('paper')

    await expect(panel.getByText(/providers failed/i)).toBeVisible({ timeout: 5000 })

    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.type(' still editable')
    await expect(editor).toContainText('still editable')
  })
})
