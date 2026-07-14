import { fetchDatamuseThesaurus } from '@/lib/thesaurus/providers/datamuseThesaurus'

const fetchMock = jest.fn()

describe('fetchDatamuseThesaurus', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  it('returns no results for blank target without fetching', async () => {
    await expect(fetchDatamuseThesaurus('   ')).resolves.toMatchObject({ concepts: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normalizes/encodes target, passes abort signal, and preserves classifications', async () => {
    const controller = new AbortController()
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [{ word: 'Vision', score: 10, tags: ['f:12', 'n'] }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ word: 'vision', score: 99 }, { word: 'goal', score: 8 }] })

    const result = await fetchDatamuseThesaurus(' Dream! ', controller.signal)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain('rel_syn=dream')
    expect(fetchMock.mock.calls[1][0]).toContain('ml=dream')
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal)
    expect(result.concepts.map((concept) => [concept.normalizedWord, concept.relationship])).toEqual([
      ['vision', 'synonym'],
      ['goal', 'related'],
    ])
  })

  it('throws for non-ok and malformed responses', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(fetchDatamuseThesaurus('dream')).rejects.toThrow('HTTP 503')

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ word: 'vision' }) })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] })
    await expect(fetchDatamuseThesaurus('dream')).rejects.toThrow('malformed')
  })
})
