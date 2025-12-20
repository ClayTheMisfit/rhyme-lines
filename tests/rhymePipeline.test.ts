import { selectTargetWord, normalizeRhymeToken } from '@/lib/rhyme/targetWord'
import { dedupeForTest, type RhymeFilterSelection } from '@/lib/rhyme/aggregate'
import { buildCacheKey } from '@/lib/rhyme/cache'
import type { ProviderCandidate } from '@/lib/rhyme/providers'

describe('target word selector', () => {
  test('prioritizes caret word with punctuation and apostrophes', () => {
    const result = selectTargetWord({
      text: "I'm testing, rhymes!",
      caretIndex: 6, // inside "testing"
      lastTypedWord: 'fallback',
    })

    expect(result?.word).toBe('testing')
    expect(result?.normalized).toBe('testing')
    expect(result?.source).toBe('caret')
  })

  test('falls back to last typed word when caret not in token', () => {
    const result = selectTargetWord({
      text: 'Numbers 123 should skip',
      caretIndex: 8,
      lastTypedWord: "can't-stop",
    })

    expect(result?.normalized).toBe("can't-stop")
    expect(result?.source).toBe('lastTyped')
  })
})

describe('candidate dedupe and normalization', () => {
  const filters: RhymeFilterSelection = { perfect: true, near: true, slant: true }

  test('dedupes case-insensitive results and picks best quality', () => {
    const candidates: ProviderCandidate[] = [
      { word: 'Flow', quality: 'slant', score: 10, provider: 'local' },
      { word: 'flow', quality: 'perfect', score: 15, provider: 'datamuse' },
      { word: 'flow', quality: 'near', score: 12, provider: 'rhymebrain' },
    ]

    const merged = dedupeForTest(candidates, filters)
    expect(merged).toHaveLength(1)
    expect(merged[0].quality).toBe('perfect')
    expect(merged[0].providers.sort()).toEqual(['datamuse', 'local', 'rhymebrain'].sort())
  })

  test('keeps deterministic ordering via alphabetical tie breaker', () => {
    const candidates: ProviderCandidate[] = [
      { word: 'bar', quality: 'near', score: 5, provider: 'local' },
      { word: 'foo', quality: 'near', score: 5, provider: 'local' },
    ]
    const merged = dedupeForTest(candidates, filters)
    expect(merged.map((item) => item.word)).toEqual(['bar', 'foo'])
  })
})

describe('cache key correctness', () => {
  test('encodes filters and normalized target', () => {
    const filters: RhymeFilterSelection = { perfect: true, near: false, slant: true }
    const keyA = buildCacheKey('Test', filters)
    const keyB = buildCacheKey('test', filters)
    const keyC = buildCacheKey('test', { ...filters, near: true })

    expect(keyA).toBe(keyB)
    expect(keyA).not.toBe(keyC)
    expect(normalizeRhymeToken('Test')).toBe('test')
  })
})
