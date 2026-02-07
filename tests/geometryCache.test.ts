import { GeometryCache } from '@/lib/overlay/geometryCache'

describe('geometry cache overlay reuse', () => {
  it('does not reuse tokens for overlays that were never measured', () => {
    const cache = new GeometryCache()
    cache.set('doc-1', 'line-1', 'layout', 'sig', 'syllables', { tokens: [], lineOffset: 1 })

    const missing = cache.get('doc-1', 'line-1', 'layout', 'sig', 'rhymes')
    expect(missing).toBeNull()
  })
})
