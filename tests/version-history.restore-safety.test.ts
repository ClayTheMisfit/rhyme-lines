import { evaluateRestoreEligibility } from '@/lib/cloud-sync/client'
import { emptyDocumentMetadata, type CloudSyncState } from '@/lib/cloud-sync/metadata'

const association = (state: CloudSyncState) => ({
  ...emptyDocumentMetadata(),
  cloudDocumentId: 'cloud-1',
  lastKnownServerRevision: 8,
  lastKnownLifecycle: 'ACTIVE' as const,
  lastSyncedLocalVersion: 'local-v8',
  state,
})

describe('version restore safety policy', () => {
  it.each([
    ['synced', true],
    ['pending', false],
    ['offline', false],
    ['error', false],
    ['conflict', false],
    ['auth-required', false],
    ['account-switch', false],
  ] as Array<[CloudSyncState, boolean]>)('%s restore eligibility is %s', (state, allowed) => {
    const result = evaluateRestoreEligibility({
      online: state !== 'offline',
      accountState: state === 'account-switch' ? 'account-switch' : state === 'auth-required' ? 'auth-required' : 'ready',
      association: association(state),
      inFlight: false,
      localMatches: true,
    })
    expect(result.allowed).toBe(allowed)
  })

  it('rejects a nominally synced document with pending local content or an in-flight operation', () => {
    expect(evaluateRestoreEligibility({ online: true, accountState: 'ready', association: association('synced'), inFlight: false, localMatches: false }).allowed).toBe(false)
    expect(evaluateRestoreEligibility({ online: true, accountState: 'ready', association: association('synced'), inFlight: true, localMatches: true }).allowed).toBe(false)
  })
})
