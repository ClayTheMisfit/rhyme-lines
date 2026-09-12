import { expect, test } from '@playwright/test'
import {
  DRAFTS_STORAGE_KEY,
  openProject,
  readPersistedDrafts,
  seedProjects,
} from './fixtures/project'

test.describe('Document lifecycle', () => {
  test('deleting the final editor document remains empty after reload', async ({ page }) => {
    await seedProjects(page, [
      { id: 'final-document', title: 'Final Document', content: 'remove me permanently' },
    ])
    await openProject(page, 'final-document')

    await page.getByRole('button', { name: 'Actions for Final Document' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('dialog', { name: 'Delete Final Document' })
      .getByRole('button', { name: 'Delete' })
      .click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible()
    await expect.poll(async () => page.evaluate((key) => {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as { data?: { drafts?: unknown[]; activeId?: string | null } }
      return {
        count: parsed.data?.drafts?.length,
        activeId: parsed.data?.activeId,
      }
    }, DRAFTS_STORAGE_KEY)).toEqual({ count: 0, activeId: null })

    await page.reload()
    await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible()
    await expect(page.getByText('Untitled', { exact: true })).toHaveCount(0)
    expect(await readPersistedDrafts(page)).toEqual([])
  })

  test('archived and trashed projects leave ordinary editor navigation', async ({ page }) => {
    await seedProjects(page, [
      { id: 'project-a', title: 'Archive This', content: 'archived content' },
      { id: 'project-b', title: 'Trash This', content: 'trashed content' },
    ], 'project-a')
    await page.goto('/')

    await page.locator('summary[aria-label="More actions for Archive This"]').click()
    await page.getByRole('button', { name: 'Archive Archive This' }).click()
    await expect(page.getByText('Archive This', { exact: true })).toHaveCount(0)

    await page.getByRole('link', { name: 'Open Trash This' }).click()
    await expect(page.getByRole('button', { name: 'Trash This', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Archive This', exact: true })).toHaveCount(0)

    await page.getByRole('link', { name: 'Back to dashboard' }).click()
    await page.locator('summary[aria-label="More actions for Trash This"]').click()
    await page.getByRole('button', { name: 'Delete Trash This' }).click()
    await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible()

    await page.goto('/editor/project-b')
    await expect(page).toHaveURL('/')
    await page.getByRole('button', { name: /^Archived/ }).click()
    await expect(page.getByText('Archive This', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /^Trash/ }).click()
    await expect(page.getByText('Trash This', { exact: true })).toBeVisible()
  })
})
