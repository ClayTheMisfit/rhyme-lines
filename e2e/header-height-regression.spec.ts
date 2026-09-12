import { expect, test } from '@playwright/test'
import { openTestEditor } from './fixtures/project'

test.describe('Editor header height regression', () => {
  test('keeps header height consistent when the rhyme panel is toggled', async ({ page }) => {
    await openTestEditor(page)

    const header = page.getByTestId('editor-header')
    const panel = page.getByTestId('rhyme-panel')
    await expect(header).toBeVisible()

    if (await panel.isVisible()) {
      await page.getByRole('button', { name: 'Hide rhyme panel', exact: true }).click()
      await page.waitForFunction(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--panel-right-offset').trim() === '0px'
      )
    }

    const closed = await header.boundingBox()
    expect(closed).not.toBeNull()

    await page.getByRole('button', { name: 'Show rhyme panel', exact: true }).click()
    await expect(panel).toBeVisible()
    await page.waitForFunction(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--panel-right-offset').trim() !== '0px'
    )

    const open = await header.boundingBox()
    expect(open).not.toBeNull()
    expect(Math.abs(closed!.height - open!.height)).toBeLessThanOrEqual(1)
    expect(open!.y).toBeGreaterThanOrEqual(0)
    expect(open!.y).toBeLessThanOrEqual(1)
  })
})
