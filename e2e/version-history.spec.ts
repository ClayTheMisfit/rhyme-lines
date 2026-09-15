import { expect, test } from '@playwright/test'
import { openTestEditor } from './fixtures/project'

test.describe('Version History foundation', () => {
  test('opens from the keyboard-accessible command palette without requiring anonymous writers to sign in', async ({ page }) => {
    const editor = await openTestEditor(page, {
      id: 'local-history-draft',
      title: 'Local History Draft',
      content: 'anonymous local writing remains available',
    })

    await expect(editor).toContainText('anonymous local writing remains available')
    await page.getByRole('button', { name: 'Open command palette' }).click()
    await page.getByRole('option', { name: /Version History/ }).click()

    await expect(page.getByRole('heading', { name: 'Version History' })).toBeVisible()
    await expect(page.getByText('Immutable checkpoints for this synced document.')).toBeVisible()
    await expect(page.getByText('Sign in and sync this document to use Version History.')).toBeVisible()
    await expect(editor).toContainText('anonymous local writing remains available')

    await page.getByRole('button', { name: 'Close Version History' }).click()
    await expect(page.getByRole('button', { name: 'Open command palette' })).toBeFocused()
  })
})
