import { expect, test } from '@playwright/test'
import { openProject, readPersistedDrafts, seedProjects } from './fixtures/project'

const projects = [
  { id: 'doc-a', title: 'Alpha', createdAt: 1000, content: 'alpha lines', position: 1000 },
  { id: 'doc-b', title: 'Beta', createdAt: 2000, content: 'beta lines', position: 2000 },
  { id: 'doc-c', title: 'Gamma', createdAt: 3000, content: 'gamma lines', position: 3000 },
]

test.describe('editor document sidebar management', () => {
  test('renames, pins, reorders, deletes, and persists after refresh', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await seedProjects(page, projects, 'doc-a')
    await openProject(page, 'doc-a')
    await expect(page.getByRole('button', { name: 'Alpha', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Actions for Beta' }).click()
    await page.getByRole('menuitem', { name: 'Rename' }).click()
    await page.getByRole('textbox', { name: 'Rename Beta' }).fill('Bridge Draft')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Bridge Draft', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Actions for Gamma' }).click()
    await page.getByRole('menuitem', { name: 'Pin' }).click()
    await expect(page.getByLabel(/Gamma, pinned/)).toBeVisible()

    await page.getByRole('listitem', { name: /Alpha, active document/ }).press('Alt+ArrowDown')
    await page.getByRole('button', { name: 'Actions for Bridge Draft' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(page.getByRole('dialog', { name: 'Delete Bridge Draft' })).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('button', { name: 'Bridge Draft', exact: true })).toBeHidden()

    await expect.poll(async () => {
      const persisted = await readPersistedDrafts(page)
      return persisted.map((draft) => ({ id: draft.docId, title: draft.title }))
    }).toEqual([
      { id: 'doc-a', title: 'Alpha' },
      { id: 'doc-c', title: 'Gamma' },
    ])
    await page.reload()
    await expect(page.getByRole('button', { name: 'Alpha', exact: true })).toBeVisible()
    await expect(page.getByLabel(/Gamma, pinned/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bridge Draft', exact: true })).toBeHidden()

    const persisted = await page.evaluate(() => JSON.parse(window.localStorage.getItem('rhyme-lines:persist:drafts') ?? '{}'))
    expect(persisted.data.drafts.map((draft: { docId: string }) => draft.docId)).toEqual(['doc-a', 'doc-c'])
    expect(persisted.data.drafts.find((draft: { docId: string }) => draft.docId === 'doc-c')?.isPinned).toBe(true)
  })
})
