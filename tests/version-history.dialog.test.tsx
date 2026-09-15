import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VersionHistoryDialog } from '@/components/history/VersionHistoryDialog'
import { cloudSyncManager } from '@/lib/cloud-sync/client'

jest.mock('@/lib/cloud-sync/client', () => ({
  cloudSyncManager: {
    getHistoryTarget: jest.fn(() => ({ cloudDocumentId: 'cloud-1', currentRevision: 9 })),
    getRestoreEligibility: jest.fn(() => ({ allowed: true, cloudDocumentId: 'cloud-1', baseRevision: 9 })),
    restoreVersion: jest.fn(async () => ({ ok: true, document: { revision: 10 } })),
  },
}))

jest.mock('@/store/cloudSyncStore', () => ({
  useCloudSyncStore: (selector: (state: unknown) => unknown) => selector({
    accountState: 'ready',
    documentStates: { 'local-1': 'synced' },
  }),
}))

const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
}) as Response

describe('VersionHistoryDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock })
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('/version-3')) {
        return response({ version: {
          id: 'version-3',
          documentId: 'cloud-1',
          sourceRevision: 3,
          title: 'Historical title',
          lines: [{ id: 'line-1', text: 'HISTORICAL_SENTINEL' }],
          lifecycle: 'ACTIVE',
          lifecycleChangedAt: null,
          isPinned: false,
          position: 1,
          clientCreatedAt: 100,
          clientUpdatedAt: 300,
          reason: 'AUTO',
          createdAt: '2026-09-15T12:00:00.000Z',
        } })
      }
      return response({ versions: [{
        id: 'version-3', sourceRevision: 3, title: 'Historical title', lifecycle: 'ACTIVE', reason: 'AUTO', createdAt: '2026-09-15T12:00:00.000Z',
      }], nextCursor: null })
    })
  })

  afterAll(() => { delete (globalThis as { fetch?: typeof fetch }).fetch })

  it('loads metadata first, presents a read-only preview, and requires restore confirmation', async () => {
    render(<VersionHistoryDialog documentId="local-1" open onOpenChange={() => {}} />)
    const entry = await screen.findByRole('listitem')
    expect(fetchMock.mock.calls[0][0].toString()).toContain('limit=20')
    expect(fetchMock.mock.calls[0][0].toString()).not.toContain('version-3')

    fireEvent.click(entry)
    const preview = await screen.findByLabelText('Read-only historical preview')
    expect(preview).toHaveAttribute('aria-readonly', 'true')
    expect(preview).toHaveTextContent('HISTORICAL_SENTINEL')

    fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }))
    expect(cloudSyncManager.restoreVersion).not.toHaveBeenCalled()
    expect(screen.getByRole('group', { name: 'Confirm restore' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm restore' }))
    await waitFor(() => expect(cloudSyncManager.restoreVersion).toHaveBeenCalledWith('local-1', 'version-3'))
    expect(await screen.findByText('Restored as revision 10.')).toBeInTheDocument()
  })
})
