import { dedupeForTest, type RhymeFilterSelection } from '@/lib/rhyme/aggregate'
import { buildCacheKey } from '@/lib/rhyme/cache'
import type { ProviderCandidate } from '@/lib/rhyme/providers'

const allFilters: RhymeFilterSelection = { perfect: true, near: true, slant: true }

const brainFixture = (order: string[] = [
  'rain','zain','hayne','feign','layne','ane','pain','chain','train','gain','main','plain','lane','drain','strain','vein','reign','sane','crane',
]): ProviderCandidate[] => order.map((word, index) => ({
  word,
  quality: 'perfect',
  score: 900 - index,
  provider: index % 2 === 0 ? 'datamuse' : 'rhymebrain',
  syllables: 1,
  frequency: ['rain','pain','chain','train','gain','main','plain','lane','drain','strain','vein','reign','sane','crane'].includes(word) ? 72 : word === 'feign' ? 18 : undefined,
}))

describe('canonical rhyme quality pipeline', () => {
  test('brain quality keeps common exact rhymes ahead of uncommon valid words and excludes name/archaic artifacts', () => {
    const ranked = dedupeForTest(brainFixture(), allFilters, 'brain')
    const words = ranked.map((item) => item.normalized)

    expect(words.slice(0, 12)).toEqual(expect.arrayContaining(['rain', 'pain', 'train', 'chain', 'gain', 'main']))
    expect(words).not.toEqual(expect.arrayContaining(['zain', 'hayne', 'layne', 'ane']))
    expect(words).toContain('feign')
    for (const common of ['rain', 'pain', 'train', 'chain', 'gain']) {
      expect(words.indexOf(common)).toBeLessThan(words.indexOf('feign'))
    }
    expect(ranked.every((item) => item.quality === 'perfect')).toBe(true)
  })

  test('normalizes provider scores before ranking', () => {
    const ranked = dedupeForTest([
      { word: 'rain', quality: 'perfect', score: 0.9, provider: 'local', syllables: 1, frequency: 80 },
      { word: 'zain', quality: 'perfect', score: 900, provider: 'datamuse', syllables: 1 },
    ], allFilters, 'brain')

    expect(ranked[0].normalized).toBe('rain')
    expect(ranked.map((item) => item.normalized)).not.toContain('zain')
  })

  test('dedupes casing, whitespace, and quote variants into one candidate', () => {
    const ranked = dedupeForTest([
      { word: 'rain', quality: 'perfect', score: 80, provider: 'local' },
      { word: 'Rain', quality: 'perfect', score: 300, provider: 'datamuse' },
      { word: ' "rain" ', quality: 'near', score: 92, provider: 'rhymebrain' },
    ], allFilters, 'brain')

    expect(ranked).toHaveLength(1)
    expect(ranked[0].normalized).toBe('rain')
    expect(ranked[0].providers).toEqual(['datamuse', 'local', 'rhymebrain'])
    expect(ranked[0].sources).toEqual(['datamuse', 'local', 'rhymebrain'])
  })

  test.each(['brain', 'Brain', 'brain!', '“brain”'])('excludes query variant %s from suggestions', (query) => {
    const ranked = dedupeForTest([
      { word: 'brain', quality: 'perfect', score: 100, provider: 'local' },
      { word: 'rain', quality: 'perfect', score: 100, provider: 'local' },
    ], allFilters, query)

    expect(ranked.map((item) => item.normalized)).toEqual(['rain'])
  })

  test('proper-name policy does not over-filter ordinary words also used as names', () => {
    const ranked = dedupeForTest([
      { word: 'Zain', quality: 'perfect', score: 95, provider: 'rhymebrain' },
      { word: 'Rose', quality: 'perfect', score: 80, provider: 'datamuse', frequency: 78 },
      { word: 'Hope', quality: 'perfect', score: 80, provider: 'datamuse', frequency: 78 },
      { word: 'Grace', quality: 'perfect', score: 80, provider: 'datamuse', frequency: 78 },
      { word: 'Rain', quality: 'perfect', score: 80, provider: 'datamuse', frequency: 78 },
    ], allFilters, 'brain')

    expect(ranked.map((item) => item.normalized)).toEqual(expect.arrayContaining(['rose', 'hope', 'grace', 'rain']))
    expect(ranked.map((item) => item.normalized)).not.toContain('zain')
  })

  test('archaic and dialect metadata rejects default results while common modern words remain', () => {
    const ranked = dedupeForTest([
      { word: 'ane', quality: 'perfect', score: 100, provider: 'datamuse', tags: ['archaic'] },
      { word: 'rain', quality: 'perfect', score: 80, provider: 'datamuse', frequency: 80 },
    ], allFilters, 'brain')
    expect(ranked.map((item) => item.normalized)).toEqual(['rain'])
  })

  test('filters categories and all mode prioritizes stronger categories without duplicating candidates', () => {
    const candidates: ProviderCandidate[] = [
      { word: 'rain', quality: 'perfect', score: 60, provider: 'local' },
      { word: 'rain', quality: 'slant', score: 100, provider: 'datamuse' },
      { word: 'grain', quality: 'near', score: 95, provider: 'datamuse', frequency: 50 },
      { word: 'run', quality: 'slant', score: 95, provider: 'datamuse', frequency: 80 },
    ]
    expect(dedupeForTest(candidates, { perfect: true, near: false, slant: false }, 'brain').map((item) => item.quality)).toEqual(['perfect'])
    expect(dedupeForTest(candidates, { perfect: false, near: true, slant: false }, 'brain').map((item) => item.quality)).toEqual(['near'])
    expect(dedupeForTest(candidates, { perfect: false, near: false, slant: true }, 'brain').every((item) => item.quality === 'slant')).toBe(true)
    const all = dedupeForTest(candidates, allFilters, 'brain')
    expect(all[0].quality).toBe('perfect')
    expect(all.filter((item) => item.normalized === 'rain')).toHaveLength(1)
  })

  test('frequency and syllable fit influence ties without overriding category', () => {
    const ranked = dedupeForTest([
      { word: 'explain', quality: 'perfect', score: 90, provider: 'local', syllables: 2, frequency: 55 },
      { word: 'rain', quality: 'perfect', score: 90, provider: 'local', syllables: 1, frequency: 80 },
      { word: 'common', quality: 'slant', score: 100, provider: 'local', syllables: 1, frequency: 100 },
    ], allFilters, 'brain')
    expect(ranked[0].normalized).toBe('rain')
    expect(ranked.findIndex((item) => item.normalized === 'common')).toBeGreaterThan(ranked.findIndex((item) => item.normalized === 'explain'))
  })

  test('provider agreement adds a bonus but cannot override better category', () => {
    const ranked = dedupeForTest([
      { word: 'rain', quality: 'perfect', score: 70, provider: 'local', frequency: 80 },
      { word: 'grain', quality: 'near', score: 100, provider: 'datamuse', frequency: 90 },
      { word: 'grain', quality: 'near', score: 100, provider: 'rhymebrain', frequency: 90 },
    ], allFilters, 'brain')
    expect(ranked[0].normalized).toBe('rain')
    expect(ranked.find((item) => item.normalized === 'grain')?.providers).toHaveLength(2)
  })

  test('ranking is deterministic when provider response order changes', () => {
    const forward = dedupeForTest(brainFixture(), allFilters, 'brain').map((item) => item.normalized)
    const reverse = dedupeForTest(brainFixture().reverse(), allFilters, 'brain').map((item) => item.normalized)
    expect(reverse).toEqual(forward)
  })

  test('syllable fit acts as tie-breaker when other scores are equal', () => {
    const ranked = dedupeForTest([
      { word: 'explain', quality: 'perfect', score: 80, provider: 'local', syllables: 2, frequency: 60 },
      { word: 'rain', quality: 'perfect', score: 80, provider: 'local', syllables: 1, frequency: 60 },
    ], allFilters, 'brain', 1)
    expect(ranked[0].normalized).toBe('rain')
    expect(ranked[1].normalized).toBe('explain')
  })

  test('broader corpus suppresses malformed and name-like results while preserving useful rhymes', () => {
    for (const query of ['time','light','heart','alone','motion','better','pain','show','cold','dream']) {
      const ranked = dedupeForTest([
        { word: `${query}\n`, quality: 'perfect', score: 1000, provider: 'datamuse' },
        { word: 'Zain', quality: 'perfect', score: 1000, provider: 'datamuse' },
        { word: query === 'time' ? 'rhyme' : query === 'light' ? 'night' : query === 'heart' ? 'part' : query === 'alone' ? 'stone' : query === 'motion' ? 'ocean' : query === 'better' ? 'letter' : query === 'pain' ? 'rain' : query === 'show' ? 'flow' : query === 'cold' ? 'gold' : 'team', quality: 'perfect', score: 50, provider: 'local', frequency: 80 },
        { word: 'sparse-near', quality: 'near', score: 40, provider: 'local' },
      ], allFilters, query)
      expect(ranked.length).toBeGreaterThan(0)
      expect(new Set(ranked.map((item) => item.normalized)).size).toBe(ranked.length)
      expect(ranked.map((item) => item.normalized)).not.toEqual(expect.arrayContaining([query, 'zain']))
      expect(ranked[0].quality).toBe('perfect')
    }
  })

  test('cache keys include filters and ranking version', () => {
    const perfect = buildCacheKey('Brain', { perfect: true, near: false, slant: false })
    const near = buildCacheKey('brain', { perfect: false, near: true, slant: false })
    expect(perfect).not.toBe(near)
    expect(perfect).toContain('ranking:lexical-v2')
  })
})
