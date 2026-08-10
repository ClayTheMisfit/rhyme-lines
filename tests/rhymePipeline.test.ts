import { selectTargetWord, normalizeRhymeToken } from '@/lib/rhyme/targetWord'
import { dedupeForTest, type RhymeFilterSelection } from '@/lib/rhyme/aggregate'
import { buildCacheKey, RHYME_PIPELINE_VERSION } from '@/lib/rhyme/cache'
import type { ProviderCandidate } from '@/lib/rhyme/providers'
import { classifyCandidate } from '@/lib/rhyme/wordQuality'

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

  it('versions cached rankings when the candidate pipeline changes', () => {
    expect(buildCacheKey('same', { perfect: true, near: true, slant: true }))
      .toContain(`v${RHYME_PIPELINE_VERSION}|same|`)
  })
})

describe('lexical-quality ranking', () => {
  const filters = { perfect: true, near: true, slant: true }
  const samePool = ['came', 'name', 'game', 'maim', 'aime', 'ame', 'fame', 'blame', 'shame', 'claim', 'flame', 'frame', 'tame']
  const candidates = (words: string[]): ProviderCandidate[] => words.map((word) => ({
    word,
    quality: 'perfect',
    score: 100,
    provider: 'fixture',
  }))

  it('ranks a complete same candidate pool before the six-result preview is sliced', () => {
    const canonical = dedupeForTest(candidates(samePool), filters)
    const preview = canonical.slice(0, 6).map((entry) => entry.word)

    expect(preview).not.toContain('aime')
    expect(preview).not.toContain('ame')
    expect(canonical.map((entry) => entry.word)).toEqual(expect.arrayContaining([
      'fame', 'blame', 'shame', 'claim', 'flame', 'frame', 'tame',
    ]))
    expect(new Set(canonical.map((entry) => entry.normalized)).size).toBe(canonical.length)
  })

  it('is deterministic regardless of provider response order', () => {
    const forward = dedupeForTest(candidates(samePool), filters).map((entry) => entry.word)
    const reversed = dedupeForTest(candidates([...samePool].reverse()), filters).map((entry) => entry.word)
    expect(reversed).toEqual(forward)
  })

  it('keeps different words sharing a rhyme family while merging normalized provider duplicates', () => {
    const input: ProviderCandidate[] = [
      ...candidates(['came', 'name', 'fame', 'game']),
      { word: 'Fame', quality: 'perfect', score: 80, provider: 'second' },
      { word: 'fame  ', quality: 'perfect', score: 70, provider: 'third' },
    ]
    const canonical = dedupeForTest(input, filters)
    expect(canonical.map((entry) => entry.normalized).sort()).toEqual(['came', 'fame', 'game', 'name'])
    expect(canonical.find((entry) => entry.normalized === 'fame')?.providers.sort()).toEqual(['fixture', 'second', 'third'])
  })

  it('produces deterministic rankings regardless of input casing for same normalized value', () => {
    const inputLowerFirst: ProviderCandidate[] = [
      { word: 'fame', quality: 'perfect', score: 100, provider: 'provider1' },
      { word: 'Fame', quality: 'perfect', score: 100, provider: 'provider2' },
      { word: 'blame', quality: 'perfect', score: 100, provider: 'provider1' },
      { word: 'Blame', quality: 'perfect', score: 100, provider: 'provider2' },
      { word: 'aime', quality: 'perfect', score: 100, provider: 'provider1' },
      { word: 'Aime', quality: 'perfect', score: 100, provider: 'provider2' },
    ]
    const inputUpperFirst: ProviderCandidate[] = [
      { word: 'Fame', quality: 'perfect', score: 100, provider: 'provider2' },
      { word: 'fame', quality: 'perfect', score: 100, provider: 'provider1' },
      { word: 'Blame', quality: 'perfect', score: 100, provider: 'provider2' },
      { word: 'blame', quality: 'perfect', score: 100, provider: 'provider1' },
      { word: 'Aime', quality: 'perfect', score: 100, provider: 'provider2' },
      { word: 'aime', quality: 'perfect', score: 100, provider: 'provider1' },
    ]

    const resultsLowerFirst = dedupeForTest(inputLowerFirst, filters)
    const resultsUpperFirst = dedupeForTest(inputUpperFirst, filters)

    // Rankings should be identical regardless of input casing/order
    expect(resultsLowerFirst.map((entry) => entry.normalized)).toEqual(
      resultsUpperFirst.map((entry) => entry.normalized)
    )

    // Verify that classification-based ranking is working (blame/fame should rank higher than aime)
    const normalizedWords = resultsLowerFirst.map((entry) => entry.normalized)
    expect(normalizedWords.indexOf('blame')).toBeLessThan(normalizedWords.indexOf('aime'))
    expect(normalizedWords.indexOf('fame')).toBeLessThan(normalizedWords.indexOf('aime'))
  })

  it.each(['perfect', 'near', 'slant'] as const)('applies lexical quality in %s mode', (quality) => {
    const modeFilters = { perfect: false, near: false, slant: false, [quality]: true }
    const pool = candidates(samePool).map((candidate) => ({ ...candidate, quality }))
    const preview = dedupeForTest(pool, modeFilters).slice(0, 6).map((entry) => entry.word)
    expect(preview).not.toContain('aime')
    expect(preview).not.toContain('ame')
  })

  it('separates pronunciation eligibility from ordinary-English evidence', () => {
    expect(classifyCandidate('fame').qualityTier).toBe('uncommon')
    expect(classifyCandidate('aime').qualityTier).toBe('rare')
    expect(classifyCandidate('ame').qualityTier).toBe('rare')
  })

  it('does not treat missing corpus frequency as sufficient reason to reject a dictionary word', () => {
    expect(classifyCandidate('bright').qualityTier).toBe('common')
    expect(classifyCandidate('zyme').qualityTier).toBe('rare')
  })
})
