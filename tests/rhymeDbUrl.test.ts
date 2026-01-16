import { buildDbUrl } from '@/lib/rhyme-db/buildDbUrl'

describe('buildDbUrl', () => {
  it('builds an absolute db URL from the base origin', () => {
    expect(buildDbUrl('http://localhost:3000')).toBe(
      'http://localhost:3000/rhyme-db/rhyme-db.v2.json?v=2'
    )
  })
})
