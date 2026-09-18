/** @jest-environment node */

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  checkpointCloudDocument,
  CloudDocumentConflictError,
  CloudDocumentNotFoundError,
  getCloudDocumentVersion,
  listCloudDocumentVersions,
  restoreCloudDocumentVersion,
} from '@/lib/cloud-sync/service'
import { GET as listVersions, POST as checkpointVersion } from '@/app/api/cloud/documents/[id]/versions/route'
import { GET as getVersion } from '@/app/api/cloud/documents/[id]/versions/[versionId]/route'
import { POST as restoreVersion } from '@/app/api/cloud/documents/[id]/versions/[versionId]/restore/route'

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
    CloudHistoryCursorError: class extends Error {},
    checkpointCloudDocument: jest.fn(),
    listCloudDocumentVersions: jest.fn(),
    getCloudDocumentVersion: jest.fn(),
    restoreCloudDocumentVersion: jest.fn(),
  }
})

const userMock = jest.mocked(getCurrentUser)
const checkpointMock = jest.mocked(checkpointCloudDocument)
const listMock = jest.mocked(listCloudDocumentVersions)
const getMock = jest.mocked(getCloudDocumentVersion)
const restoreMock = jest.mocked(restoreCloudDocumentVersion)
const context = { params: Promise.resolve({ id: 'cloud-1' }) }
const versionContext = { params: Promise.resolve({ id: 'cloud-1', versionId: 'version-3' }) }

describe('version history route authorization and payload boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    userMock.mockResolvedValue({ id: 'server-user', name: null, email: null, image: null })
  })

  it('lists bounded metadata using authenticated server identity', async () => {
    listMock.mockResolvedValue({ versions: [], nextCursor: null })
    const response = await listVersions(new Request('http://localhost/api/cloud/documents/cloud-1/versions?limit=20'), context)
    expect(response.status).toBe(200)
    expect(listMock).toHaveBeenCalledWith('server-user', 'cloud-1', { cursor: null, limit: 20 })
  })

  it('checkpoints only the expected revision and never forwards client lyric content', async () => {
    checkpointMock.mockResolvedValue({ id: 'version-8' } as never)
    const request = new Request('http://localhost/api/cloud/documents/cloud-1/versions', {
      method: 'POST',
      body: JSON.stringify({ expectedRevision: 8, reason: 'AUTO', lines: [{ text: 'FORGED_HISTORY' }], userId: 'attacker' }),
    })
    expect((await checkpointVersion(request, context)).status).toBe(201)
    expect(checkpointMock).toHaveBeenCalledWith('server-user', 'cloud-1', 8)
  })

  it('uses document plus version ownership scope for a selected snapshot', async () => {
    getMock.mockRejectedValue(new CloudDocumentNotFoundError())
    const response = await getVersion(new Request('http://localhost'), versionContext)
    expect(response.status).toBe(404)
    expect(getMock).toHaveBeenCalledWith('server-user', 'cloud-1', 'version-3')
  })

  it('returns 409 for a stale restore base without retrying', async () => {
    restoreMock.mockRejectedValue(new CloudDocumentConflictError('cloud-1', 8, 9))
    const response = await restoreVersion(new Request('http://localhost', {
      method: 'POST', body: JSON.stringify({ baseRevision: 8 }),
    }), versionContext)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'conflict', documentId: 'cloud-1', expectedRevision: 8, currentRevision: 9,
    })
    expect(restoreMock).toHaveBeenCalledTimes(1)
  })

  it('rejects anonymous version operations before service access', async () => {
    userMock.mockResolvedValue(null)
    expect((await listVersions(new Request('http://localhost'), context)).status).toBe(401)
    expect((await checkpointVersion(new Request('http://localhost', { method: 'POST', body: '{}' }), context)).status).toBe(401)
    expect((await getVersion(new Request('http://localhost'), versionContext)).status).toBe(401)
    expect((await restoreVersion(new Request('http://localhost', { method: 'POST', body: '{}' }), versionContext)).status).toBe(401)
    expect(listMock).not.toHaveBeenCalled()
    expect(checkpointMock).not.toHaveBeenCalled()
    expect(getMock).not.toHaveBeenCalled()
    expect(restoreMock).not.toHaveBeenCalled()
  })
})
