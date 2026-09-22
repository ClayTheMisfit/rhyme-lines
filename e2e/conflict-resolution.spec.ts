import { expect, test } from '@playwright/test'
import { openTestEditor, readPersistedDrafts } from './fixtures/project'
import type { CloudDocumentDto } from '../src/lib/cloud-sync/contracts'

const initialCloud: CloudDocumentDto = { id: 'conflict-cloud', clientDocumentId: 'conflict-e2e', title: 'Cloud Song', lines: [{ id: 'cloud-line', text: 'CLOUD_SENTINEL' }], clientCreatedAt: 100, clientUpdatedAt: 300, lifecycle: 'ACTIVE', lifecycleChangedAt: null, isPinned: false, position: 300, revision: 5, deletedAt: null, serverUpdatedAt: '2026-09-18T00:00:00Z' }

test.describe('Conflict Resolution', () => {
  for (const action of ['Keep Local', 'Use Cloud', 'Save Both']) {
    test(`${action} previews, confirms, and durably preserves whole documents`, async ({ page }) => {
      let cloud = { ...initialCloud }
      await page.route('**/api/account', (route) => route.fulfill({ json: { user: { id: 'conflict-test-account' } } }))
      await page.route('**/api/cloud/documents**', async (route) => {
        const request = route.request()
        if (request.url().endsWith('/resolve')) {
          const input = request.postDataJSON()
          if (input.baseRevision !== cloud.revision) return route.fulfill({ status: 409, json: { currentRevision: cloud.revision } })
          cloud = { ...cloud, title: input.title, lines: input.lines, revision: cloud.revision + 1 }
          return route.fulfill({ json: { document: cloud } })
        }
        if (request.url().endsWith('/conflict-cloud')) return route.fulfill({ json: { document: cloud } })
        if (request.method() === 'POST' && request.url().endsWith('/documents')) return route.fulfill({ json: { document: { ...initialCloud, ...request.postDataJSON(), id: 'copy-cloud', revision: 1 } } })
        return route.fulfill({ json: { documents: [cloud], tombstones: [], versions: [], nextCursor: null } })
      })
      const editor = await openTestEditor(page, { id: 'conflict-e2e', title: 'Local Song', content: 'LOCAL_SENTINEL', createdAt: 100, updatedAt: 200 })
      await expect(page.getByText('Cloud: Sync conflict')).toBeVisible()
      await page.reload()
      await expect(editor).toContainText('LOCAL_SENTINEL')
      await page.getByRole('button', { name: 'Resolve', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByLabel('Read-only local preview')).toContainText('LOCAL_SENTINEL')
      await expect(dialog.getByLabel('Read-only cloud preview')).toContainText('CLOUD_SENTINEL')
      await expect(dialog.locator('[contenteditable]')).toHaveCount(0)
      // Radix traps focus and Escape closes without applying a choice.
      await page.keyboard.press('Shift+Tab')
      await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Resolve', exact: true })).toBeFocused()
      await page.getByRole('button', { name: 'Resolve', exact: true }).click()
      await expect(dialog.getByLabel('Read-only cloud preview')).toContainText('CLOUD_SENTINEL')
      await dialog.getByRole('button', { name: action, exact: true }).click()
      await expect(dialog.getByRole('button', { name: `Confirm ${action}`, exact: true })).toBeVisible()
      if (action === 'Keep Local') {
        cloud = { ...cloud, revision: 6, lines: [{ id: 'new', text: 'UNSEEN_CLOUD_SENTINEL' }] }
        await dialog.getByRole('button', { name: 'Confirm Keep Local', exact: true }).click()
        await expect(dialog.getByText('A version changed. Review the refreshed previews and choose again.')).toBeVisible()
        await expect(dialog.getByLabel('Read-only cloud preview')).toContainText('UNSEEN_CLOUD_SENTINEL')
        await expect(editor).toContainText('LOCAL_SENTINEL')
        await dialog.getByRole('button', { name: action, exact: true }).click()
      }
      await dialog.getByRole('button', { name: `Confirm ${action}`, exact: true }).click()
      await expect(dialog).not.toBeVisible()
      const persisted = await readPersistedDrafts(page)
      if (action === 'Keep Local') {
        expect(cloud.revision).toBe(7); expect(persisted[0].lines[0].text).toBe('LOCAL_SENTINEL')
      } else {
        expect(cloud.revision).toBe(5)
        expect(persisted.find((draft) => draft.docId === 'conflict-e2e')?.lines[0].text).toBe('CLOUD_SENTINEL')
        expect(persisted.find((draft) => draft.docId !== 'conflict-e2e')?.lines[0].text).toBe('LOCAL_SENTINEL')
      }
      await page.reload()
      await expect(page.getByText('Cloud: Sync conflict')).toHaveCount(0)
    })
  }
})
