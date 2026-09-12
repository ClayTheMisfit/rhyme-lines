import { expect, test } from '@playwright/test'
import { openProject, openTestEditor, seedProjects, waitForPersistedDraft } from './fixtures/project'

test.describe('Editor autosave', () => {
  test('persists edited text and restores it after reload', async ({ page }) => {
    const editor = await openTestEditor(page, {
      id: 'autosave-draft',
      title: 'Autosave Draft',
      content: 'before edit',
    })

    await editor.fill('saved through the persistence coordinator')
    expect(await page.getByText('Unsaved changes', { exact: true }).textContent()).toBe('Unsaved changes')
    await waitForPersistedDraft(page, 'autosave-draft', (draft) =>
      draft.lines.some((line) => line.text.includes('saved through the persistence coordinator'))
    )
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()

    await page.reload()
    await expect(page.locator('#lyric-editor')).toContainText('saved through the persistence coordinator')

    await page.goto('/')
    await openProject(page, 'autosave-draft')
    await expect(page.locator('#lyric-editor')).toContainText('saved through the persistence coordinator')
  })

  test('flushes the latest edit during an immediate reload before debounce', async ({ page }) => {
    const editor = await openTestEditor(page, {
      id: 'reload-draft',
      title: 'Reload Draft',
      content: 'before reload',
    })

    await editor.fill('RELOAD BEFORE DEBOUNCE 92841')
    await page.reload()

    await expect(page.locator('#lyric-editor')).toContainText('RELOAD BEFORE DEBOUNCE 92841')
  })

  test('flushes the latest edit when navigating to the dashboard before debounce', async ({ page }) => {
    const editor = await openTestEditor(page, {
      id: 'navigation-draft',
      title: 'Navigation Draft',
      content: 'before navigation',
    })

    await editor.fill('NAVIGATE BEFORE DEBOUNCE 61402')
    await page.getByRole('link', { name: 'Back to dashboard' }).click()
    await expect(page).toHaveURL('/')
    await openProject(page, 'navigation-draft')

    await expect(page.locator('#lyric-editor')).toContainText('NAVIGATE BEFORE DEBOUNCE 61402')
  })

  test('flushes the edited document when switching tabs before debounce', async ({ page }) => {
    await seedProjects(page, [
      { id: 'switch-a', title: 'Switch A', content: 'original A' },
      { id: 'switch-b', title: 'Switch B', content: 'original B' },
    ], 'switch-a')
    const editor = await openProject(page, 'switch-a')

    await editor.fill('SWITCH BEFORE DEBOUNCE 77193')
    await page.getByRole('button', { name: 'Switch B', exact: true }).click()
    await expect(page).toHaveURL('/editor/switch-b')
    await page.getByRole('button', { name: 'Switch A', exact: true }).click()
    await expect(page).toHaveURL('/editor/switch-a')
    await page.reload()

    await expect(page.locator('#lyric-editor')).toContainText('SWITCH BEFORE DEBOUNCE 77193')
  })
})
