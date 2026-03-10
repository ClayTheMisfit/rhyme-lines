import { tokenizeLine, isWordLikeToken } from '@/lib/analysis/tokenize'
import {
  buildRhymeDecorations,
  computeRhymeFamilies,
  getEndWordTokenIndex,
  getRhymeFamilyKey,
  normalizeWord,
  shouldRenderRhymeToken,
} from '@/lib/rhyme/rhymeDecorations'

type TokenInput = { id: string; rhymeKey: string }

const buildTokens = (text: string): TokenInput[] =>
  tokenizeLine(text)
    .filter((token) => isWordLikeToken(token))
    .map((token, index) => {
      const normalized = normalizeWord(token.analysisKey ?? token.text)
      const rhymeKey = getRhymeFamilyKey(normalized)
      if (!rhymeKey) return null
      return { id: `token-${index}`, rhymeKey }
    })
    .filter((token): token is TokenInput => token !== null)

describe('computeRhymeFamilies', () => {
  it('returns no families for non-rhyming input', () => {
    const tokens = buildTokens('hey my name is clayton')
    const { familyIdByTokenId, familyIdByRhymeKey } = computeRhymeFamilies(tokens)

    expect(familyIdByTokenId.size).toBe(0)
    expect(familyIdByRhymeKey.size).toBe(0)
  })

  it('groups rhyming tokens into the same family', () => {
    const tokens = buildTokens('cat hat')
    const { familyIdByTokenId, familyIdByRhymeKey } = computeRhymeFamilies(tokens)

    expect(familyIdByRhymeKey.size).toBe(1)
    expect(familyIdByTokenId.size).toBe(2)
    const familyIds = new Set(familyIdByTokenId.values())
    expect(familyIds.size).toBe(1)
  })


  it('groups punctuation and casing variants into the same family', () => {
    const tokens = buildTokens('light Light, HEIGHT. night! Sight?')
    const { familyIdByTokenId, familyIdByRhymeKey } = computeRhymeFamilies(tokens)

    expect(familyIdByRhymeKey.size).toBe(1)
    expect(familyIdByTokenId.size).toBe(5)
  })

})

describe('buildRhymeDecorations', () => {
  it('leaves familyId undefined when no rhyme families exist', () => {
    const lines = [{ id: 'line-0', text: 'hey my name is clayton' }]
    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: false, highlightStopwords: false })
    const tokens = result.tokensByLine.get('line-0') ?? []

    expect(result.familyCount).toBe(0)
    expect(tokens.every((token) => token.familyId === undefined)).toBe(true)
  })

  it('assigns the same familyId to a rhyme pair', () => {
    const lines = [{ id: 'line-0', text: 'cat hat' }]
    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: true, highlightStopwords: false })
    const tokens = result.tokensByLine.get('line-0') ?? []
    const familyIds = new Set(tokens.map((token) => token.familyId))

    expect(result.familyCount).toBe(1)
    expect(familyIds.has(undefined)).toBe(false)
    expect(familyIds.size).toBe(1)
  })


  it('highlights punctuation/casing variants and groups them with base words', () => {

    const lines = [
      { id: 'base-light', text: 'light' },
      { id: 'base-height', text: 'height' },
      { id: 'base-night', text: 'night' },
      { id: 'base-sight', text: 'sight' },
      { id: 'punct-light', text: 'Light,' },
      { id: 'punct-height', text: 'HEIGHT.' },
      { id: 'punct-night', text: 'night!' },
      { id: 'punct-sight', text: 'Sight?' },
    ]

    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: false, highlightStopwords: false })

    const tokenFor = (lineId: string) => {
      const lineTokens = result.tokensByLine.get(lineId) ?? []
      expect(lineTokens.length).toBeGreaterThan(0)
      return lineTokens[0]
    }

    const baseLight = tokenFor('base-light')
    const baseHeight = tokenFor('base-height')
    const baseNight = tokenFor('base-night')
    const baseSight = tokenFor('base-sight')
    const punctLight = tokenFor('punct-light')
    const punctHeight = tokenFor('punct-height')
    const punctNight = tokenFor('punct-night')
    const punctSight = tokenFor('punct-sight')

    const punctuationTokens = [punctLight, punctHeight, punctNight, punctSight]
    punctuationTokens.forEach((token) => {
      expect(token.familyId).not.toBeUndefined()
    })

    expect(punctLight.familyId).toBe(baseLight.familyId)
    expect(punctHeight.familyId).toBe(baseHeight.familyId)
    expect(punctNight.familyId).toBe(baseNight.familyId)
    expect(punctSight.familyId).toBe(baseSight.familyId)

    expect(result.familyCount).toBe(1)
  })


  it('groups hat/mat/cat together and excludes dog', () => {
    const lines = [
      { id: 'line-hat', text: 'hat' },
      { id: 'line-mat', text: 'mat' },
      { id: 'line-cat', text: 'cat' },
      { id: 'line-dog', text: 'dog' },
    ]

    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: false, highlightStopwords: false })

    const hat = (result.tokensByLine.get('line-hat') ?? [])[0]
    const mat = (result.tokensByLine.get('line-mat') ?? [])[0]
    const cat = (result.tokensByLine.get('line-cat') ?? [])[0]
    const dog = (result.tokensByLine.get('line-dog') ?? [])[0]

    expect(hat.familyId).toBeDefined()
    expect(mat.familyId).toBe(hat.familyId)
    expect(cat.familyId).toBe(hat.familyId)
    expect(dog.familyId).toBeUndefined()
  })


  it('normalizes punctuation and casing for hat-family grouping', () => {
    const lines = [
      { id: 'line-0', text: 'Hat,' },
      { id: 'line-1', text: 'MAT!' },
      { id: 'line-2', text: 'cat?' },
    ]
    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: false, highlightStopwords: false })
    const familyIds = lines.map((line) => (result.tokensByLine.get(line.id) ?? [])[0]?.familyId)

    expect(familyIds.every((familyId) => familyId !== undefined)).toBe(true)
    expect(new Set(familyIds).size).toBe(1)
  })


  it('assigns one familyId across full -AT clusters', () => {
    const lines = [
      { id: 'line-mat', text: 'mat' },
      { id: 'line-hat', text: 'hat' },
      { id: 'line-rat', text: 'rat' },
      { id: 'line-fat', text: 'fat' },
      { id: 'line-cat', text: 'cat' },
      { id: 'line-bat', text: 'bat' },
    ]

    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: false, highlightStopwords: false })
    const familyIds = lines.map((line) => (result.tokensByLine.get(line.id) ?? [])[0]?.familyId)

    expect(familyIds.every((familyId) => familyId !== undefined)).toBe(true)
    expect(new Set(familyIds).size).toBe(1)
    expect(result.familyCount).toBe(1)
  })

  it('groups time/rhyme/chime into the same family', () => {
    const lines = [
      { id: 'line-time', text: 'time' },
      { id: 'line-rhyme', text: 'rhyme' },
      { id: 'line-chime', text: 'chime' },
    ]

    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: false, highlightStopwords: false })
    const familyIds = lines.map((line) => (result.tokensByLine.get(line.id) ?? [])[0]?.familyId)

    expect(familyIds.every((familyId) => familyId !== undefined)).toBe(true)
    expect(new Set(familyIds).size).toBe(1)
    expect(result.familyCount).toBe(1)
  })

  it('marks the last word token as end word despite trailing punctuation', () => {
    const tokens = tokenizeLine('brain, rest—')
    expect(getEndWordTokenIndex(tokens)).toBe(tokens.length - 1)
  })

  it('keeps grouped meridiem tokens eligible for end-word detection', () => {
    const spaced = tokenizeLine('meet at 10 pm')
    const compact = tokenizeLine('meet at 11p.m.')

    expect(spaced.at(-1)?.kind).toBe('meridiem')
    expect(spaced.at(-1)?.analysisKey).toBe('10pm')
    expect(getEndWordTokenIndex(spaced)).toBe(spaced.length - 1)

    expect(compact.at(-1)?.kind).toBe('meridiem')
    expect(compact.at(-1)?.analysisKey).toBe('11pm')
    expect(getEndWordTokenIndex(compact)).toBe(compact.length - 1)
  })
})


describe('highlight mode selectors', () => {
  const sample = {
    id: 'line-0-0',
    lineId: 'line-0',
    lineIndex: 0,
    start: 0,
    end: 4,
    word: 'time',
    familyKey: 'ime',
    familyId: 3,
    underline: false,
    isEndWord: false,
  }

  it('renders by mode rules', () => {
    expect(shouldRenderRhymeToken(sample, 'off', null)).toBe(false)
    expect(shouldRenderRhymeToken(sample, 'all', null)).toBe(true)
    expect(shouldRenderRhymeToken(sample, 'end', null)).toBe(false)
    expect(shouldRenderRhymeToken({ ...sample, isEndWord: true }, 'end', null)).toBe(true)
    expect(shouldRenderRhymeToken(sample, 'focus', null)).toBe(false)
    expect(shouldRenderRhymeToken(sample, 'focus', 3)).toBe(true)
  })
})
