/** @jest-environment node */

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  CloudDocumentConflictError,
  CloudDocumentNotFoundError,
  createCloudDocument,
  getCloudDocument,
  updateCloudDocument,
} from '@/lib/cloud-sync/service'
import { GET as listDocuments, POST as createDocument } from '@/app/api/cloud/documents/route'
import { GET as getDocument, PUT as updateDocument } from '@/app/api/cloud/documents/[id]/route'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/auth/current-user', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/cloud-sync/service', () => {
  class NotFound extends Error {}
  class Conflict extends Error {
    details: unknown
    constructor(documentId: string, expectedRevision: number, currentRevision: number) {
      super('conflict')
      this.details = { error: 'conflict', documentId, expectedRevision, currentRevision }
    }
  }
  return {
    CloudDocumentConflictError: Conflict,
    CloudDocumentNotFoundError: NotFound,
    CloudDocumentTransitionError: class extends Error {},
    createCloudDocument: jest.fn(),
    listCloudDocuments: jest.fn(),
    getCloudDocument: jest.fn(),
    updateCloudDocument: jest.fn(),
    transitionCloudDocument: jest.fn(),
  }
})

const userMock = jest.mocked(getCurrentUser)
const createMock = jest.mocked(createCloudDocument)
const getMock = jest.mocked(getCloudDocument)
const updateMock = jest.mocked(updateCloudDocument)
const valid = {
  clientDocumentId: 'local-1',
  title: 'Sentinel',
  lines: [{ id: 'line-1', text: 'safe sentinel' }],
  clientCreatedAt: 100,
  clientUpdatedAt: 200,
  lifecycle: 'ACTIVE' as const,
  lifecycleChangedAt: null,
  isPinned: false,
  position: 200,
}

describe('cloud document route authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    userMock.mockResolvedValue({ id: 'server-user', name: null, email: null, image: null })
  })

  it('uses only the server identity and strips a browser-supplied userId', async () => {
    createMock.mockResolvedValue({ id: 'cloud-1' } as never)
    const request = new Request('http://localhost/api/cloud/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...valid, userId: 'attacker-selected-user' }),
    })
    const response = await createDocument(request)
    expect(response.status).toBe(201)
    expect(createMock).toHaveBeenCalledWith('server-user', valid)
  })

  it('rejects anonymous list and create requests before database access', async () => {
    userMock.mockResolvedValue(null)
    expect((await listDocuments()).status).toBe(401)
    expect((await createDocument(new Request('http://localhost', { method: 'POST', body: '{}' }))).status).toBe(401)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('maps non-owned reads to generic not found', async () => {
    getMock.mockRejectedValue(new CloudDocumentNotFoundError())
    const response = await getDocument(new Request('http://localhost'), { params: Promise.resolve({ id: 'guessed-id' }) })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
  })

  it('returns safe revision metadata for a stale update', async () => {
    updateMock.mockRejectedValue(new CloudDocumentConflictError('cloud-1', 4, 5))
    const request = new Request('http://localhost', {
      method: 'PUT', body: JSON.stringify({ ...valid, baseRevision: 4 }),
    })
    const response = await updateDocument(request, { params: Promise.resolve({ id: 'cloud-1' }) })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'conflict', documentId: 'cloud-1', expectedRevision: 4, currentRevision: 5,
    })
  })
})
