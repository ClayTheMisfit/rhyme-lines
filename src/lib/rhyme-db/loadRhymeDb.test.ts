import { parseRhymeDbPayload, selectRhymeDbPayload } from '@/lib/rhyme-db/loadRhymeDb'
import { RHYME_DB_VERSION } from '@/lib/rhyme-db/version'

type MinimalDb = {
  version?: number
  words: string[]
  freqByWordId?: number[]
}

const basePayload = (): MinimalDb => ({
  words: ['time'],
  freqByWordId: [1],
})

describe('parseRhymeDbPayload', () => {
  it('assumes v1 when version is missing', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => parseRhymeDbPayload(basePayload(), { expectedVersion: 1, allowLegacy: true })).not.toThrow()
    warnSpy.mockRestore()
  })

  it('throws when version mismatches', () => {
    expect(() =>
      parseRhymeDbPayload({ ...basePayload(), version: 999 }, { expectedVersion: 1 })
    ).toThrow('Rhyme DB version mismatch: detected v999, expected v1')
  })

  it('accepts the current version', () => {
    expect(() => parseRhymeDbPayload({ ...basePayload(), version: RHYME_DB_VERSION })).not.toThrow()
  })

  it('prefers v2 payloads when available', () => {
    const result = selectRhymeDbPayload({
      v2: { ...basePayload(), version: RHYME_DB_VERSION },
      v1: basePayload(),
    })

    expect(result.status.loadedVersion).toBe(2)
    expect(result.status.source).toBe('v2-asset')
  })

  it('falls back to v1 when v2 is invalid', () => {
    const result = selectRhymeDbPayload({
      v2: { ...basePayload(), version: 999 },
      v1: basePayload(),
    })

    expect(result.status.loadedVersion).toBe(1)
    expect(result.status.source).toBe('v1-fallback')
    expect(result.status.error).toContain('Rhyme DB version mismatch')
  })
})
