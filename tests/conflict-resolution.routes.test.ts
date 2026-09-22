/** @jest-environment node */
import { POST } from '@/app/api/cloud/documents/[id]/resolve/route'
import { getCurrentUser } from '@/lib/auth/current-user'
import { resolveKeepLocal, CloudDocumentConflictError, CloudDocumentNotFoundError } from '@/lib/cloud-sync/service'
import { MAX_CLOUD_REQUEST_BYTES } from '@/lib/cloud-sync/validation'
jest.mock('server-only', () => ({}))
jest.mock('@/lib/auth/current-user', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/cloud-sync/service', () => {
  class Conflict extends Error { details: unknown; constructor(id: string, expected: number, current: number) { super('conflict'); this.details = { error: 'conflict', documentId: id, expectedRevision: expected, currentRevision: current } } }
  return { resolveKeepLocal: jest.fn(), CloudDocumentConflictError: Conflict, CloudDocumentNotFoundError: class extends Error {} }
})
const input = { clientDocumentId: 'local-1', title: 'Song', lines: [{ id: 'line', text: 'SENTINEL' }], clientCreatedAt: 100, clientUpdatedAt: 200, lifecycle: 'ACTIVE', lifecycleChangedAt: null, isPinned: false, position: 200, baseRevision: 5, intent: 'keep-local', userId: 'forged-user' }
const request = (body: unknown) => new Request('http://localhost/api/cloud/documents/cloud-1/resolve', { method: 'POST', body: JSON.stringify(body) })
const context = { params: Promise.resolve({ id: 'cloud-1' }) }
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getCurrentUser).mockResolvedValue({ id: 'server-user', name: null, email: null, image: null }); jest.mocked(resolveKeepLocal).mockResolvedValue({ revision: 6 } as never) })
it('derives identity from session and forwards only validated candidate fields', async () => {
  const response = await POST(request(input), context)
  expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(resolveKeepLocal).toHaveBeenCalledWith('server-user', 'cloud-1', expect.objectContaining({ baseRevision: 5, lines: input.lines }))
  expect(jest.mocked(resolveKeepLocal).mock.calls[0][2]).not.toHaveProperty('userId')
})
it('requires authentication before mutation', async () => { jest.mocked(getCurrentUser).mockResolvedValue(null); expect((await POST(request(input), context)).status).toBe(401); expect(resolveKeepLocal).not.toHaveBeenCalled() })
it.each([{ ...input, intent: 'merge' }, { ...input, baseRevision: 0 }, { ...input, lifecycle: 'DELETED' }, { ...input, lines: [] }, { ...input, title: 'x'.repeat(101) }, { ...input, clientUpdatedAt: -1 }])('rejects invalid resolution payload', async (body) => { expect((await POST(request(body), context)).status).toBe(400); expect(resolveKeepLocal).not.toHaveBeenCalled() })
it('enforces bounded requests', async () => { expect((await POST(request({ ...input, lines: [{ id: 'line', text: 'x'.repeat(MAX_CLOUD_REQUEST_BYTES) }] }), context)).status).toBe(400) })
it('returns safe stale revision metadata', async () => { jest.mocked(resolveKeepLocal).mockRejectedValue(new CloudDocumentConflictError('cloud-1', 5, 6)); const response = await POST(request(input), context); expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ currentRevision: 6 }); })
it('hides unowned document existence', async () => { jest.mocked(resolveKeepLocal).mockRejectedValue(new CloudDocumentNotFoundError()); expect((await POST(request(input), context)).status).toBe(404) })
it('does not expose private error details', async () => { jest.mocked(resolveKeepLocal).mockRejectedValue(new Error('SECRET_LYRICS')); const response = await POST(request(input), context); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('SECRET_LYRICS') })
