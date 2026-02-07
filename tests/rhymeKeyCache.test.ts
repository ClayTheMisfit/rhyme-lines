import { RhymeKeyCache } from '@/lib/rhyme/highlightKeyCache'

describe('rhyme key cache runtime separation', () => {
  it('stores results per runtime key', () => {
    const cache = new RhymeKeyCache()

    cache.set('none', 'time', null)
    cache.set('cmu:v1', 'time', 'AY1-M')

    expect(cache.get('none', 'time')).toBeNull()
    expect(cache.get('cmu:v1', 'time')).toBe('AY1-M')
  })
})
