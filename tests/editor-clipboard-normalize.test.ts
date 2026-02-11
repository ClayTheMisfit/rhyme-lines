import { normalizePastedText } from '@/editor'

describe('normalizePastedText', () => {
  test('normalizes CRLF and preserves line breaks', () => {
    expect(normalizePastedText('a\r\nb\rc')).toBe('a\nb\nc')
  })

  test('keeps leading/trailing whitespace', () => {
    expect(normalizePastedText('  line  \r\n next ')).toBe('  line  \n next ')
  })

  test('strips zero-width chars', () => {
    expect(normalizePastedText('a\u200Bb\uFEFFc')).toBe('abc')
  })
})
