import { tokenizeLine, isWordLikeToken } from '@/lib/analysis/tokenize'
import {
  buildRhymeDecorations,
  computeRhymeFamilies,
  getEndWordTokenIndex,
  getRhymeFamilyKey,
  normalizeWord,
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
