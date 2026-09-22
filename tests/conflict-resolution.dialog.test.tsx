import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConflictResolutionDialog } from '@/components/cloud-sync/ConflictResolutionDialog'
import { cloudSyncManager } from '@/lib/cloud-sync/client'
import { getAuthoritativeDraftCollection, initializeDraftPersistence, replaceAuthoritativeDraftCollection, resetDraftPersistenceForTests } from '@/lib/persist/draftCoordinator'
import type { ConflictPreview } from '@/lib/cloud-sync/client'
import type { DraftSchema } from '@/lib/persist/schema'
let mockAccountState = 'ready'
jest.mock('@/store/cloudSyncStore', () => ({ useCloudSyncStore: (selector: (state: unknown) => unknown) => selector({ accountState: mockAccountState, documentStates: { 'local-1': 'conflict' } }) }))
jest.mock('@/lib/cloud-sync/client', () => ({
  ...jest.requireActual('@/lib/cloud-sync/client'),
  cloudSyncManager: { getConflictTarget: jest.fn(() => 'cloud-1'), getConflictBlock: jest.fn(() => null), inspectConflict: jest.fn(), resolveConflict: jest.fn() },
}))
const local: DraftSchema = { docId: 'local-1', title: 'Local Song', createdAt: 100, updatedAt: 200, lines: [{ id: 'line', text: 'LOCAL_SENTINEL' }] }
let preview: ConflictPreview
beforeEach(() => {
  jest.clearAllMocks(); resetDraftPersistenceForTests(); localStorage.clear(); mockAccountState = 'ready'
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  initializeDraftPersistence({ drafts: [local], activeId: local.docId }, { allowPersistence: true })
  const { conflictLocalMarker } = jest.requireActual('@/lib/cloud-sync/client')
  preview = { accountId: 'user-a', local, localMarker: conflictLocalMarker(local), localKnownRevision: 3, detectedAt: Date.now(), cloud: { id: 'cloud-1', clientDocumentId: 'local-1', title: 'Cloud Song', lines: [{ id: 'cloud', text: 'CLOUD_SENTINEL' }], lifecycle: 'TRASHED', revision: 5, serverUpdatedAt: '2026-09-18T00:00:00Z', clientCreatedAt: 100, clientUpdatedAt: 300, lifecycleChangedAt: null, deletedAt: null, isPinned: false, position: 300 } }
  jest.mocked(cloudSyncManager.inspectConflict).mockResolvedValue(preview)
  jest.mocked(cloudSyncManager.resolveConflict).mockResolvedValue({ ok: true })
  jest.mocked(cloudSyncManager.getConflictBlock).mockReturnValue(null)
})
it.each(['Keep Local', 'Use Cloud', 'Save Both'])('%s displays read-only lifecycle previews and explicit confirmation', async (label) => {
  render(<ConflictResolutionDialog documentId="local-1" open onOpenChange={() => {}} />)
  expect(await screen.findByText('CLOUD_SENTINEL')).toBeVisible()
  expect(screen.getByLabelText('Read-only local preview')).toHaveAttribute('aria-readonly', 'true')
  expect(screen.getByLabelText('Read-only cloud preview')).toHaveAttribute('aria-readonly', 'true')
  expect(screen.getByText('Cloud version · TRASHED')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: label, exact: true }))
  expect(cloudSyncManager.resolveConflict).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: `Confirm ${label}`, exact: true }))
  await waitFor(() => expect(cloudSyncManager.resolveConflict).toHaveBeenCalledTimes(1))
})
it('disables offline actions with accessible explanation and local preview', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  jest.mocked(cloudSyncManager.inspectConflict).mockRejectedValue(new Error('Reconnect to resolve this conflict.'))
  render(<ConflictResolutionDialog documentId="local-1" open onOpenChange={() => {}} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Keep Local', exact: true })).toBeDisabled())
  expect(screen.getByLabelText('Read-only local preview')).toHaveTextContent('LOCAL_SENTINEL')
  expect(screen.getAllByText('Reconnect to resolve this conflict.').length).toBeGreaterThan(0)
})
it('invalidates confirmation on canonical local edits', async () => {
  render(<ConflictResolutionDialog documentId="local-1" open onOpenChange={() => {}} />)
  await screen.findByText('CLOUD_SENTINEL')
  fireEvent.click(screen.getByRole('button', { name: 'Keep Local', exact: true }))
  act(() => replaceAuthoritativeDraftCollection({ ...getAuthoritativeDraftCollection(), drafts: [{ ...local, updatedAt: 201 }] }, { persist: 'immediate' }))
  expect(screen.queryByRole('button', { name: 'Confirm Keep Local' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Keep Local', exact: true })).toBeDisabled()
})
it('refreshes stale server preview and requires another choice', async () => {
  jest.mocked(cloudSyncManager.resolveConflict).mockResolvedValue({ ok: false, kind: 'stale', message: 'changed' })
  render(<ConflictResolutionDialog documentId="local-1" open onOpenChange={() => {}} />)
  await screen.findByText('CLOUD_SENTINEL')
  fireEvent.click(screen.getByRole('button', { name: 'Use Cloud', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Use Cloud', exact: true }))
  await screen.findByText('A version changed. Review the refreshed previews and choose again.')
  expect(cloudSyncManager.inspectConflict).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('button', { name: 'Confirm Use Cloud' })).not.toBeInTheDocument()
})
it('clears fetched private previews when account changes', async () => {
  const view = render(<ConflictResolutionDialog documentId="local-1" open onOpenChange={() => {}} />)
  await screen.findByText('CLOUD_SENTINEL')
  mockAccountState = 'account-switch'
  view.rerender(<ConflictResolutionDialog documentId="local-1" open onOpenChange={() => {}} />)
  expect(screen.queryByText('CLOUD_SENTINEL')).not.toBeInTheDocument()
})
it('Cancel closes without resolving', async () => {
  const close = jest.fn()
  render(<ConflictResolutionDialog documentId="local-1" open onOpenChange={close} />)
  await screen.findByText('CLOUD_SENTINEL')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }))
  expect(close).toHaveBeenCalledWith(false); expect(cloudSyncManager.resolveConflict).not.toHaveBeenCalled()
})
