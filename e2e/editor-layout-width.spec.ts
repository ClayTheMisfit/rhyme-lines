import { expect, test, type Page } from '@playwright/test'
import { openTestEditor } from './fixtures/project'

async function editorLayoutMetrics(page: Page) {
  return page.evaluate(() => {
    const scroll = document.querySelector<HTMLElement>('[data-editor-scroll]')
    const root = document.querySelector<HTMLElement>('.editor-root')
    const grid = document.querySelector<HTMLElement>('.rl-editor-grid')
    const surface = document.querySelector<HTMLElement>('.editor-surface')
    const editor = document.querySelector<HTMLElement>('#lyric-editor')
    if (!scroll || !root || !grid || !surface || !editor) {
      throw new Error('Editor layout elements were not found')
    }

    const scrollRect = scroll.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const gridRect = grid.getBoundingClientRect()
    const surfaceRect = surface.getBoundingClientRect()
    const editorRect = editor.getBoundingClientRect()
    const gridStyles = getComputedStyle(grid)
    const rootStyles = getComputedStyle(root)

    return {
      scrollWidth: scrollRect.width,
      rootWidth: rootRect.width,
      gridWidth: gridRect.width,
      surfaceWidth: surfaceRect.width,
      editorWidth: editorRect.width,
      rootMaxWidth: rootStyles.maxWidth,
      gridTemplateColumns: gridStyles.gridTemplateColumns,
      scrollOverflowX: getComputedStyle(scroll).overflowX,
    }
  })
}


test.describe('editor writing surface width', () => {
  test('uses available width on wide screens and restores after docked rhyme panel closes', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await openTestEditor(page)

    const editor = page.locator('#lyric-editor')
    await editor.click()
    await editor.fill('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty')

    const panel = page.locator('[data-testid="rhyme-panel"]')
    if (await panel.isVisible()) {
      await panel.getByRole('button', { name: 'Close panel', exact: true }).click()
      await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--panel-right-offset').trim() === '0px')
    }

    const full = await editorLayoutMetrics(page)
    expect(full.rootMaxWidth).toBe('none')
    expect(full.gridTemplateColumns).not.toContain('1120px')
    expect(full.surfaceWidth).toBeGreaterThan(1120)
    expect(full.rootWidth).toBeGreaterThan(1480)
    expect(Math.abs(full.editorWidth - full.surfaceWidth)).toBeLessThanOrEqual(1)
    expect(Math.abs(full.gridWidth - full.rootWidth)).toBeLessThanOrEqual(1)

    const toggle = page.getByRole('button', { name: /rhyme panel/i })
    await expect(toggle).toHaveCount(1)

    if (!(await panel.isVisible())) {
      await toggle.click()
    }
    await expect(panel).toBeVisible()
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--panel-right-offset').trim() !== '0px')
    await expect.poll(async () => (await editorLayoutMetrics(page)).surfaceWidth).toBeLessThan(full.surfaceWidth - 100)

    const docked = await editorLayoutMetrics(page)
    expect(docked.surfaceWidth).toBeLessThan(full.surfaceWidth - 100)
    expect(docked.surfaceWidth).toBeGreaterThan(760)

    await panel.getByRole('button', { name: 'Close panel', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Show rhyme panel', exact: true })).toBeVisible()
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--panel-right-offset').trim() === '0px')
    await expect.poll(async () => Math.abs((await editorLayoutMetrics(page)).surfaceWidth - full.surfaceWidth)).toBeLessThanOrEqual(2)

    const restored = await editorLayoutMetrics(page)
    expect(restored.surfaceWidth).toBeGreaterThan(1120)
    expect(Math.abs(restored.surfaceWidth - full.surfaceWidth)).toBeLessThanOrEqual(2)
  })

  test('shrinks fluidly below the previous fixed text-column minimum', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await openTestEditor(page)

    const metrics = await editorLayoutMetrics(page)
    expect(metrics.gridTemplateColumns).not.toContain('760px')
    expect(metrics.surfaceWidth).toBeLessThan(760)
    expect(metrics.scrollWidth).toBeLessThanOrEqual(1024)
  })
})
