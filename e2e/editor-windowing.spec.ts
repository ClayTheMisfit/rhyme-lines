import { expect, test } from '@playwright/test'

const LONG_LINE_COUNT = 800

const seedLongDocument = async (page: import('@playwright/test').Page, lines: number) => {
  await page.evaluate((count) => {
    const editor = document.getElementById('lyric-editor')
    if (!editor) {
      throw new Error('editor not found')
    }
    const doc = editor.ownerDocument
    const fragments: HTMLDivElement[] = []
    for (let i = 0; i < count; i += 1) {
      const line = doc.createElement('div')
      line.className = 'line'
      line.dataset.lineId = `long-${i}`
      line.textContent = `long line ${i} overlay test`
      fragments.push(line)
    }
    editor.innerHTML = ''
    fragments.forEach((line) => editor.appendChild(line))
    editor.dispatchEvent(new Event('input', { bubbles: true }))
  }, lines)
}

const badgeCount = async (page: import('@playwright/test').Page) =>
  page.locator('[data-layer="overlay"] .syllable-badge').count()

test.describe('Editor overlay windowing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#lyric-editor')
  })

  test('measures only the viewport and reuses geometry when scrolling', async ({ page }) => {
    await seedLongDocument(page, LONG_LINE_COUNT)
    const scroller = page.locator('[data-editor-scroll]')

    await expect.poll(() => badgeCount(page)).toBeGreaterThan(0)

    const initialBadges = await badgeCount(page)
    expect(initialBadges).toBeLessThan(400)

    const firstBadgeTop = await page
      .locator('[data-layer="overlay"] .syllable-badge')
      .first()
      .evaluate((el) => el.getBoundingClientRect().top)

    await scroller.evaluate((node) => node.scrollTo({ top: node.scrollHeight / 2, behavior: 'auto' }))
    await expect.poll(() => badgeCount(page)).toBeLessThan(400)

    await scroller.evaluate((node) => node.scrollTo({ top: 0, behavior: 'auto' }))
    await expect.poll(() => badgeCount(page)).toBeLessThan(400)

    const resetTop = await page
      .locator('[data-layer="overlay"] .syllable-badge')
      .first()
      .evaluate((el) => el.getBoundingClientRect().top)
    expect(Math.abs(resetTop - firstBadgeTop)).toBeLessThan(2)

    await scroller.evaluate((node) => node.scrollTo({ top: node.scrollHeight, behavior: 'auto' }))
    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.type('tail check')
    await expect(editor).toContainText('tail check')
  })
})
