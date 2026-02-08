import { tokenizeLine, isWordLikeToken } from '@/lib/analysis/tokenize'
import {
  buildRhymeDecorations,
  computeRhymeFamilies,
  getRhymeFamilyKey,
  normalizeWord,
} from '@/lib/rhyme/rhymeDecorations'

type TokenInput = { id: string; rhymeKey: string }

const buildTokens = (text: string): TokenInput[] =>
  tokenizeLine(text)
    .filter((token) => isWordLikeToken(token.text))
    .map((token, index) => {
      const normalized = normalizeWord(token.text)
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
    const result = buildRhymeDecorations(lines, [])
    const tokens = result.tokensByLine.get('line-0') ?? []

    expect(result.familyCount).toBe(0)
    expect(tokens.every((token) => token.familyId === undefined)).toBe(true)
  })

  it('assigns the same familyId to a rhyme pair', () => {
    const lines = [{ id: 'line-0', text: 'cat hat' }]
    const result = buildRhymeDecorations(lines, [])
    const tokens = result.tokensByLine.get('line-0') ?? []
    const familyIds = new Set(tokens.map((token) => token.familyId))

    expect(result.familyCount).toBe(1)
    expect(familyIds.has(undefined)).toBe(false)
    expect(familyIds.size).toBe(1)
  })
})
