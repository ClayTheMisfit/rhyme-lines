import { expect, test } from '@playwright/test'
import {
  openProject,
  readPersistedDrafts,
  seedProjects,
  waitForPersistedDraft,
} from './fixtures/project'

test.describe('Dashboard and editor routes', () => {
  test('loads the dashboard and opens a persisted project', async ({ page }) => {
    await seedProjects(page, [
      { id: 'dashboard-draft', title: 'Dashboard Draft', content: 'open this draft' },
    ])

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Pick up where you left off' })).toBeVisible()
    await expect(page.getByText('Dashboard Draft', { exact: true }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Open Dashboard Draft' }).click()

    await expect(page).toHaveURL(/\/editor\/dashboard-draft$/)
    await expect(page.locator('#lyric-editor')).toContainText('open this draft')
  })

  test('supports a cold deep link and reload for an existing project', async ({ page }) => {
    await seedProjects(page, [
      { id: 'cold-draft', title: 'Cold Deep Link', content: 'survives cold navigation' },
    ])

    await openProject(page, 'cold-draft')
    await expect(page.locator('#lyric-editor')).toContainText('survives cold navigation')

    await page.reload()
    await expect(page).toHaveURL(/\/editor\/cold-draft$/)
    await expect(page.locator('#lyric-editor')).toContainText('survives cold navigation')
  })

  test('redirects a missing project route only after hydration resolves', async ({ page }) => {
    await seedProjects(page, [
      { id: 'valid-fallback', title: 'Valid Fallback', content: 'fallback content' },
    ])

    await page.goto('/editor/project-that-does-not-exist')
    await expect(page).toHaveURL(/\/editor\/valid-fallback$/, { timeout: 10_000 })
    await expect(page.locator('#lyric-editor')).toContainText('fallback content')
  })
})

test.describe('Browser persistence invariants', () => {
  test('keeps a newly created project when an earlier editor save flushes', async ({ page }) => {
    await seedProjects(page, [
      { id: 'race-a', title: 'Existing Draft', content: 'original text' },
    ])
    const editor = await openProject(page, 'race-a')

    await editor.fill('latest edit from project A')
    await page.getByRole('link', { name: 'Back to dashboard' }).click()
    await page.getByRole('button', { name: 'NEW PROJECT', exact: true }).click()
    await expect(page).toHaveURL(/\/editor\/[^/?#]+$/)
    const projectBId = new URL(page.url()).pathname.split('/').pop()
    expect(projectBId).toBeTruthy()
    expect(projectBId).not.toBe('race-a')

    await waitForPersistedDraft(page, 'race-a', (draft) =>
      draft.lines.some((line) => line.text.includes('latest edit from project A'))
    )
    await expect.poll(async () => {
      const drafts = await readPersistedDrafts(page)
      return drafts.some((draft) => draft.docId === projectBId)
    }).toBe(true)

    await page.reload()
    const persisted = await readPersistedDrafts(page)
    expect(persisted.some((draft) => draft.docId === 'race-a')).toBe(true)
    expect(persisted.some((draft) => draft.docId === projectBId)).toBe(true)

    await openProject(page, 'race-a')
    await expect(page.locator('#lyric-editor')).toContainText('latest edit from project A')
  })
})
