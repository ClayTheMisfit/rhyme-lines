import { expect, test } from '@playwright/test'
import { openTestEditor } from './fixtures/project'

test.describe('Rhyme suggestions panel', () => {
  test.beforeEach(async ({ page }) => {
    await openTestEditor(page)
    const toggle = page.getByTitle(/rhyme panel/i)
    const panel = page.locator('[data-testid="rhyme-panel"]')
    if (!(await panel.isVisible())) {
      await toggle.click()
    }
    await expect(panel).toBeVisible()
  })

  test('loads rhyme suggestions for typed query', async ({ page }) => {
    const panel = page.locator('[data-testid="rhyme-panel"]')
    const searchInput = panel.getByRole('textbox', { name: 'Type a word to get rhymes' })

    await searchInput.fill('day')
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

  test('loads local suggestions without breaking editor input', async ({ page }) => {
    const panel = page.locator('[data-testid="rhyme-panel"]')
    const searchInput = panel.getByRole('textbox', { name: 'Type a word to get rhymes' })
    await searchInput.fill('paper')
    await expect(panel.getByRole('listbox', { name: 'Rhyme suggestions' })).toBeVisible()

    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.type(' still editable')
    await expect(editor).toContainText('still editable')
  })

  test('returns representative perfect, near, and slant local suggestions', async ({ page }) => {
    const panel = page.locator('[data-testid="rhyme-panel"]')
    const searchInput = panel.getByRole('textbox', { name: 'Type a word to get rhymes' })
    await searchInput.fill('time')

    for (const quality of ['Perfect', 'Near', 'Slant']) {
      await panel.getByRole('button', { name: quality, exact: true }).click()
      const suggestions = panel.getByRole('listbox', { name: 'Rhyme suggestions' })
      await expect(suggestions).toBeVisible({ timeout: 10_000 })
      await expect(suggestions.getByText(quality.toLowerCase(), { exact: true }).first()).toBeVisible()
    }
  })

  test('falls back to the tracked v1 database when the generated v2 asset is unavailable', async ({ page }) => {
    let requestedV1 = false
    await page.route('**/rhyme-db/rhyme-db.v2.json?v=2', (route) =>
      route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' })
    )
    page.on('request', (request) => {
      if (request.url().includes('/rhyme-db/rhyme-db.v1.json?v=1')) requestedV1 = true
    })

    await page.reload()
    const panel = page.locator('[data-testid="rhyme-panel"]')
    if (!(await panel.isVisible())) {
      await page.getByTitle(/rhyme panel/i).click()
    }
    await expect(panel).toBeVisible()
    await panel.getByRole('textbox', { name: 'Type a word to get rhymes' }).fill('time')
    await expect(panel.getByRole('listbox', { name: 'Rhyme suggestions' })).toBeVisible({ timeout: 10_000 })
    await expect.poll(() => requestedV1).toBe(true)
  })
})
