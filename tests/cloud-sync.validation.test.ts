/** @jest-environment node */

import {
  CloudPayloadError,
  MAX_CLOUD_CONTENT_CHARS,
  parseCloudDocumentInput,
  parseCloudDocumentUpdateInput,
  parseLifecycleInput,
  readJsonBody,
} from '@/lib/cloud-sync/validation'

const valid = () => ({
  clientDocumentId: 'local-1',
  title: 'Draft',
  lines: [{ id: 'line-1', text: 'hello' }],
  clientCreatedAt: 100,
  clientUpdatedAt: 200,
  lifecycle: 'ACTIVE',
  lifecycleChangedAt: null,
  isPinned: false,
  position: 200,
})

describe('cloud document runtime validation', () => {
  it('accepts the explicit browser representation without a userId', () => {
    expect(parseCloudDocumentInput({ ...valid(), userId: 'untrusted' })).toEqual(valid())
  })

  it('rejects malformed lifecycle, revision, and oversized content', () => {
    expect(() => parseCloudDocumentInput({ ...valid(), lifecycle: 'DELETED' })).toThrow(CloudPayloadError)
    expect(() => parseCloudDocumentUpdateInput({ ...valid(), baseRevision: 0 })).toThrow(CloudPayloadError)
    expect(() => parseLifecycleInput({ action: 'erase', baseRevision: 1 })).toThrow(CloudPayloadError)
    expect(() => parseCloudDocumentInput({ ...valid(), lines: [{ id: 'line-1', text: 'x'.repeat(MAX_CLOUD_CONTENT_CHARS + 1) }] }))
      .toThrow(CloudPayloadError)
  })

  it('rejects a body above the byte limit before parsing it', async () => {
    const request = new Request('http://localhost/api/cloud/documents', {
      method: 'POST',
      headers: { 'content-length': '2000000' },
      body: '{}',
    })
    await expect(readJsonBody(request)).rejects.toBeInstanceOf(CloudPayloadError)
  })
})
