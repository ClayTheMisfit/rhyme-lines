import {
  CLOUD_SYNC_STORAGE_KEY,
  emptyDocumentMetadata,
  ensureAccountMetadata,
  readCloudSyncMetadata,
  writeCloudSyncMetadata,
} from '@/lib/cloud-sync/metadata'

describe('account-scoped cloud sync metadata', () => {
  beforeEach(() => localStorage.clear())

  it('persists associations and revisions without canonical lyric content or secrets', () => {
    const root = readCloudSyncMetadata()
    root.lastAccountId = 'user-a'
    const account = ensureAccountMetadata(root, 'user-a')
    account.initialized = true
    account.associations['local-1'] = {
      ...emptyDocumentMetadata(),
      cloudDocumentId: 'cloud-1',
      lastKnownServerRevision: 4,
      lastKnownLifecycle: 'ACTIVE',
      state: 'pending',
    }
    expect(writeCloudSyncMetadata(root)).toBe(true)
    expect(readCloudSyncMetadata()).toEqual(root)
    const raw = localStorage.getItem(CLOUD_SYNC_STORAGE_KEY) ?? ''
    expect(raw).not.toContain('lyric')
    expect(raw).not.toContain('access_token')
    expect(raw).not.toContain('sessionToken')
  })

  it('keeps different accounts in independent partitions', () => {
    const root = readCloudSyncMetadata()
    ensureAccountMetadata(root, 'user-a').associations.shared = { ...emptyDocumentMetadata(), cloudDocumentId: 'cloud-a' }
    ensureAccountMetadata(root, 'user-b').associations.shared = { ...emptyDocumentMetadata(), cloudDocumentId: 'cloud-b' }
    writeCloudSyncMetadata(root)
    const restored = readCloudSyncMetadata()
    expect(restored.accounts['user-a'].associations.shared.cloudDocumentId).toBe('cloud-a')
    expect(restored.accounts['user-b'].associations.shared.cloudDocumentId).toBe('cloud-b')
  })
})
