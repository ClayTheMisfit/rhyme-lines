jest.mock('@/lib/env/isClient', () => ({
  isClient: () => false,
}))

jest.mock('@/lib/persist/storage', () => ({
  readWithMigrations: jest.fn(() => {
    throw new Error('storage must not initialize during SSR')
  }),
  tryWriteVersioned: jest.fn(),
}))

import {
  flushDraftPersistence,
  getAuthoritativeDraftCollection,
  initializeDraftPersistence,
  isDraftPersistenceAllowed,
  mutateAuthoritativeDraftCollection,
  replaceAuthoritativeDraftCollection,
} from './draftCoordinator'
import { createDefaultDraftCollection } from '@/lib/persist/schema'

describe('draft persistence SSR boundary', () => {
  it('returns an in-memory default collection without reading browser storage', () => {
    expect(getAuthoritativeDraftCollection()).toEqual(
      expect.objectContaining({ drafts: expect.any(Array), activeId: expect.any(String) })
    )
  })

  it('does not mutate or claim success for persistence operations during SSR', () => {
    const initial = getAuthoritativeDraftCollection()
    initializeDraftPersistence(initial, { allowPersistence: true })

    expect(isDraftPersistenceAllowed()).toBe(false)
    expect(flushDraftPersistence()).toEqual(expect.objectContaining({
      ok: false,
      error: expect.stringContaining('outside the browser'),
    }))
    expect(replaceAuthoritativeDraftCollection(createDefaultDraftCollection(), { persist: 'immediate' }))
      .toEqual(expect.objectContaining({ ok: false }))
    expect(mutateAuthoritativeDraftCollection((collection) => collection))
      .toEqual(expect.objectContaining({ ok: false }))
  })
})
