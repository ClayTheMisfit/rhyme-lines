import { expect, test } from '@playwright/test'

const drafts = [
  { docId: 'doc-a', title: 'Alpha', createdAt: 1000, updatedAt: 1000, lines: [{ id: 'a-0', text: 'alpha lines' }], isPinned: false, position: 1000 },
  { docId: 'doc-b', title: 'Beta', createdAt: 2000, updatedAt: 2000, lines: [{ id: 'b-0', text: 'beta lines' }], isPinned: false, position: 2000 },
  { docId: 'doc-c', title: 'Gamma', createdAt: 3000, updatedAt: 3000, lines: [{ id: 'c-0', text: 'gamma lines' }], isPinned: false, position: 3000 },
]

test.describe('editor document sidebar management', () => {
  test('renames, pins, reorders, deletes, and persists after refresh', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await page.evaluate((seedDrafts) => {
      window.localStorage.setItem('rhyme-lines:persist:drafts', JSON.stringify({ version: 2, data: { drafts: seedDrafts, activeId: 'doc-a', folders: [] } }))
      window.localStorage.setItem('rhyme-lines:last-open-project-id', 'doc-a')
      window.localStorage.setItem('rhyme-lines:editor-sidebar-collapsed', 'false')
    }, drafts)

    await page.goto('/editor/doc-a')
    await expect(page.getByRole('button', { name: 'Alpha' })).toBeVisible()

    await page.getByRole('button', { name: 'Actions for Beta' }).click()
    await page.getByRole('menuitem', { name: 'Rename' }).click()
    await page.getByRole('textbox', { name: 'Rename Beta' }).fill('Bridge Draft')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Bridge Draft' })).toBeVisible()

    await page.getByRole('button', { name: 'Actions for Gamma' }).click()
    await page.getByRole('menuitem', { name: 'Pin' }).click()
    await expect(page.getByLabel(/Gamma, pinned/)).toBeVisible()

    await page.getByLabel(/Bridge Draft/).press('Alt+ArrowUp')
    await page.getByRole('button', { name: 'Actions for Alpha' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(page.getByRole('dialog', { name: 'Delete Alpha' })).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('button', { name: 'Alpha' })).toBeHidden()

    await page.waitForTimeout(400)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Bridge Draft' })).toBeVisible()
    await expect(page.getByLabel(/Gamma, pinned/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Alpha' })).toBeHidden()

    const persisted = await page.evaluate(() => JSON.parse(window.localStorage.getItem('rhyme-lines:persist:drafts') ?? '{}'))
    expect(persisted.data.drafts.map((draft: { docId: string }) => draft.docId)).toEqual(['doc-b', 'doc-c'])
    expect(persisted.data.drafts.find((draft: { docId: string }) => draft.docId === 'doc-c')?.isPinned).toBe(true)
    expect(persisted.data.drafts.find((draft: { docId: string }) => draft.docId === 'doc-b')?.title).toBe('Bridge Draft')
  })
})
