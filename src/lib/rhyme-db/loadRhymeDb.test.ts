import { parseRhymeDbPayload } from '@/lib/rhyme-db/loadRhymeDb'
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
    expect(() => parseRhymeDbPayload(basePayload())).not.toThrow()
    warnSpy.mockRestore()
  })

  it('throws when version mismatches', () => {
    expect(() => parseRhymeDbPayload({ ...basePayload(), version: 999 })).toThrow(
      'Rhyme DB version mismatch: detected v999, expected v1'
    )
  })

  it('accepts the current version', () => {
    expect(() => parseRhymeDbPayload({ ...basePayload(), version: RHYME_DB_VERSION })).not.toThrow()
  })
})
