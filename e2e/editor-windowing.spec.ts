import { expect, test } from '@playwright/test'
import { openTestEditor } from './fixtures/project'

const LINE_COUNT = 500
const LONG_TEXT = Array.from({ length: LINE_COUNT }, (_, i) => `line ${i} alpha beta`).join('\n')

test.describe('Editor long-document scrolling', () => {
  test('keeps line layout stable and accepts input after scrolling', async ({ page }) => {
    test.slow()
    const editor = await openTestEditor(page)
    await editor.click()

    await editor.fill(LONG_TEXT)

    const lines = editor.locator('.line')
    await expect(lines).toHaveCount(LINE_COUNT)

    const scroller = page.locator('[data-editor-scroll]')
    await scroller.evaluate((node) => node.scrollTo({ top: 0, behavior: 'auto' }))
    await expect.poll(async () => scroller.evaluate((node) => node.scrollTop)).toBe(0)
    await scroller.evaluate((node) => node.scrollTo({ top: node.scrollHeight, behavior: 'auto' }))

    const lastLine = lines.last()
    await lastLine.click()
    await editor.type(' typing-check')
    await expect(lastLine).toContainText('typing-check')

    await scroller.evaluate((node) => node.scrollTo({ top: 0, behavior: 'auto' }))
    await expect.poll(async () => (await lines.first().boundingBox())?.y ?? Number.POSITIVE_INFINITY).toBeGreaterThanOrEqual(0)
    const topLineBoxAfter = await lines.first().boundingBox()

    expect(topLineBoxAfter).not.toBeNull()
    expect(topLineBoxAfter!.y).toBeLessThan(page.viewportSize()?.height ?? 720)
    await expect(lines).toHaveCount(LINE_COUNT)
    await expect(lines.first()).toContainText('line 0 alpha beta')
  })
})
