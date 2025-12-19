import { expect, test } from '@playwright/test'

const LINE_COUNT = 500
const LONG_TEXT = Array.from({ length: LINE_COUNT }, (_, i) => `line ${i} alpha beta`).join('\n')

test.describe('Editor overlay windowing', () => {
  test('renders overlays only for the viewport and keeps alignment after scroll', async ({ page }) => {
    await page.goto('/')
    const editor = page.locator('#lyric-editor')
    await editor.click()

    await page.evaluate((text) => {
      const el = document.getElementById('lyric-editor')
      if (!el) return
      el.innerText = text
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }))
    }, LONG_TEXT)

    const lines = editor.locator('.line')
    await expect(lines).toHaveCount(LINE_COUNT)

    const badges = page.locator('.syllable-badge')
    await expect.poll(async () => badges.count()).toBeGreaterThan(0)
    await expect.poll(async () => badges.count()).toBeLessThan(200)

    const topBadges = page.locator('.syllable-badge[data-line-id="line-0"]')
    await expect.poll(async () => topBadges.count()).toBeGreaterThan(0)
    const topBadgeBox = await topBadges.first().boundingBox()
    const topLineBox = await lines.first().boundingBox()

    const scroller = page.locator('[data-editor-scroll]')
    await scroller.evaluate((node) => node.scrollTo({ top: node.scrollHeight, behavior: 'auto' }))

    const bottomBadges = page.locator(`.syllable-badge[data-line-id="line-${LINE_COUNT - 1}"]`)
    await expect.poll(async () => bottomBadges.count()).toBeGreaterThan(0)
    await expect.poll(async () => topBadges.count()).toBe(0)
    await expect.poll(async () => badges.count()).toBeLessThan(200)

    const lastLine = lines.last()
    await lastLine.click()
    await editor.type(' typing-check')
    await expect(lastLine).toContainText('typing-check')

    await scroller.evaluate((node) => node.scrollTo({ top: 0, behavior: 'auto' }))
    await expect.poll(async () => topBadges.count()).toBeGreaterThan(0)
    const topBadgeBoxAfter = await topBadges.first().boundingBox()
    const topLineBoxAfter = await lines.first().boundingBox()

    expect(topBadgeBoxAfter && topBadgeBox).toBeTruthy()
    expect(topLineBoxAfter && topLineBox).toBeTruthy()
    if (topBadgeBoxAfter && topBadgeBox && topLineBoxAfter && topLineBox) {
      const badgeDelta = Math.abs(topBadgeBoxAfter.y - topBadgeBox.y)
      const lineDelta = Math.abs(topLineBoxAfter.y - topLineBox.y)
      expect(badgeDelta).toBeLessThan(2)
      expect(lineDelta).toBeLessThan(2)
    }
  })
})
