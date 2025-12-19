import { expect, test } from '@playwright/test'

async function caretState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const editor = document.getElementById('lyric-editor')
    if (!editor) {
      return { focused: false, caretVisible: false }
    }

    const selection = window.getSelection()
    const style = window.getComputedStyle(editor)
    const caretColor = style.caretColor
    const backgroundColor = style.backgroundColor
    const transparent =
      !caretColor ||
      caretColor === 'transparent' ||
      caretColor === 'rgba(0, 0, 0, 0)'
    const collapsed = !!selection && selection.rangeCount > 0 && selection.getRangeAt(0).collapsed
    const anchorInside = !!selection?.anchorNode && editor.contains(selection.anchorNode)
    const caretMatchesBackground = !!caretColor && caretColor.replace(/\s+/g, '') === backgroundColor.replace(/\s+/g, '')

    const focused = document.activeElement === editor
    const caretVisible = focused && collapsed && anchorInside && !transparent && !caretMatchesBackground

    return { focused, caretVisible }
  })
}

test.describe('Editor caret and input invariants', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#lyric-editor')
  })

  test('clicking focuses editor and shows caret', async ({ page }) => {
    const editor = page.locator('#lyric-editor')
    await editor.click()

    const state = await caretState(page)
    expect(state.focused).toBe(true)
    expect(state.caretVisible).toBe(true)
  })

  test('typing renders text immediately', async ({ page }) => {
    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.type('hello')

    await expect(editor).toContainText('hello')
  })

  test('caret stays visible after theme toggle', async ({ page }) => {
    const editor = page.locator('#lyric-editor')
    await editor.click()

    await page.getByTitle('Toggle theme').click()
    await editor.click()

    const state = await caretState(page)
    expect(state.caretVisible).toBe(true)
  })

  test('caret survives scroll and continues to accept input', async ({ page }) => {
    const editor = page.locator('#lyric-editor')
    await editor.click()

    for (let i = 0; i < 30; i += 1) {
      await editor.type(`line ${i}`)
      await editor.press('Enter')
    }

    const scroller = page.locator('[data-editor-scroll]')
    await scroller.evaluate((node) => node.scrollTo({ top: node.scrollHeight, behavior: 'auto' }))

    await editor.type('after-scroll')
    const state = await caretState(page)
    expect(state.caretVisible).toBe(true)
    await expect(editor).toContainText('after-scroll')
  })
})
