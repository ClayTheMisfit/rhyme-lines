/** @jest-environment node */
import { fetchSlantRhymes } from './datamuse'

describe('Datamuse broad rhyme candidates', () => {
  it('uses the slant fallback tier when Datamuse supplies no pronunciation', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ word: 'life', score: 42, numSyllables: 1 }]), { status: 200 }),
    )

    await expect(fetchSlantRhymes('night')).resolves.toEqual([
      expect.objectContaining({ word: 'life', type: 'slant' }),
    ])
    expect(fetchMock.mock.calls[0]?.[0]).toContain('rel_nry=night')
    fetchMock.mockRestore()
  })
})
