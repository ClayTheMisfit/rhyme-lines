/** @jest-environment node */
import { dedupeForTest, type RhymeFilterSelection } from './aggregate'
import type { ProviderCandidate } from './providers'

const candidates: ProviderCandidate[] = [
  { word: 'light', quality: 'perfect', score: 100, provider: 'fixture' },
  { word: 'tide', quality: 'near', score: 80, provider: 'fixture' },
  { word: 'life', quality: 'slant', score: 60, provider: 'fixture' },
]

describe('aggregation quality filters', () => {
  it.each([
    [{ perfect: true, near: false, slant: false }, ['perfect']],
    [{ perfect: false, near: true, slant: false }, ['near']],
    [{ perfect: false, near: false, slant: true }, ['slant']],
    [{ perfect: true, near: true, slant: false }, ['perfect', 'near']],
    [{ perfect: false, near: true, slant: true }, ['near', 'slant']],
    [{ perfect: true, near: false, slant: true }, ['perfect', 'slant']],
    [{ perfect: true, near: true, slant: true }, ['perfect', 'near', 'slant']],
  ] as Array<[RhymeFilterSelection, string[]]>)('honors %o', (filters, expected) => {
    expect(dedupeForTest(candidates, filters).map(({ quality }) => quality)).toEqual(expected)
  })
})
