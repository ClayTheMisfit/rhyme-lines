import { expect, test } from '@playwright/test'

test.describe('Rhyme highlight overlay', () => {
  test('highlights rhyming words around the caret', async ({ page }) => {
    await page.goto('/')
    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.type('day play stay\nsay way')

    await page.evaluate(() => {
      const editorEl = document.querySelector('#lyric-editor')
      const line = editorEl?.querySelector('.line')
      const textNode = line?.childNodes[0]
      if (!textNode) return
      const range = document.createRange()
      range.setStart(textNode, 1)
      range.collapse(true)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    })

    const targetHighlight = page.locator('[data-testid="rhyme-highlight"][data-kind="target"]').first()
    await expect(targetHighlight).toBeVisible({ timeout: 5000 })

    const perfectHighlight = page.locator('[data-testid="rhyme-highlight"][data-kind="perfect"]').first()
    await expect(perfectHighlight).toBeVisible({ timeout: 5000 })

    const editorBox = await editor.boundingBox()
    const highlightBox = await perfectHighlight.boundingBox()
    expect(editorBox).not.toBeNull()
    expect(highlightBox).not.toBeNull()
    if (editorBox && highlightBox) {
      expect(highlightBox.x).toBeGreaterThanOrEqual(editorBox.x - 5)
      expect(highlightBox.x + highlightBox.width).toBeLessThanOrEqual(editorBox.x + editorBox.width + 5)
      expect(highlightBox.y).toBeGreaterThanOrEqual(editorBox.y - 5)
      expect(highlightBox.y + highlightBox.height).toBeLessThanOrEqual(editorBox.y + editorBox.height + 5)
    }
  })
})
