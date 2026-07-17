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

  it('normalizes/encodes target, requests Datamuse params, passes abort signal, and preserves classifications', async () => {
    const controller = new AbortController()
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [{ word: 'Vision', score: 10, tags: ['f:12', 'n'] }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ word: 'vision', score: 99 }, { word: 'goal', score: 8 }] })

    const result = await fetchDatamuseThesaurus(' Dream song! ', controller.signal)
    const synonymUrl = new URL(fetchMock.mock.calls[0][0])
    const relatedUrl = new URL(fetchMock.mock.calls[1][0])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(synonymUrl.searchParams.get('rel_syn')).toBe('dream song')
    expect(relatedUrl.searchParams.get('ml')).toBe('dream song')
    expect(synonymUrl.searchParams.get('md')).toBe('fp')
    expect(relatedUrl.searchParams.get('md')).toBe('fp')
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal)
    expect(fetchMock.mock.calls[1][1]?.signal).toBe(controller.signal)
    expect(result.concepts.map((concept) => [concept.normalizedWord, concept.relationship])).toEqual([
      ['vision', 'synonym'],
      ['goal', 'related'],
    ])
    expect(result.synonyms[0].frequency).toBe(12)
    expect(result.synonyms[0].partOfSpeech).toBe('n')
  })

  it.each([
    ['n', 'vision'],
    ['v', 'move'],
    ['adj', 'bright'],
    ['adv', 'quickly'],
    ['u', 'unknown'],
  ] as const)('parses %s part-of-speech tags', async (partOfSpeech, word) => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [{ word, score: 10, tags: [partOfSpeech] }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })

    const result = await fetchDatamuseThesaurus('dream')
    expect(result.concepts[0].partOfSpeech).toBe(partOfSpeech)
  })

  it('ignores unknown POS tags while parsing frequency tags', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [{ word: 'vision', score: 10, tags: ['x', 'f:3.5'] }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })

    const result = await fetchDatamuseThesaurus('dream')
    expect(result.concepts[0].partOfSpeech).toBeUndefined()
    expect(result.concepts[0].frequency).toBe(3.5)
  })

  it('throws for non-ok and malformed responses', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(fetchDatamuseThesaurus('dream')).rejects.toThrow('HTTP 503')

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ word: 'vision' }) })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] })
    await expect(fetchDatamuseThesaurus('dream')).rejects.toThrow('malformed')
  })

  it('ignores invalid records and validates scores', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [{ word: 1, score: 9 }, { word: 'vision', score: Number.NaN }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })

    const result = await fetchDatamuseThesaurus('dream')
    expect(result.concepts).toHaveLength(1)
    expect(result.concepts[0].score).toBe(0)
  })
})
