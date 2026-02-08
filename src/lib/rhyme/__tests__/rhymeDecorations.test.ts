import { tokenizeLine, isWordLikeToken } from '@/lib/analysis/tokenize'
import { computeRhymeFamilies, getRhymeFamilyKey, normalizeWord } from '@/lib/rhyme/rhymeDecorations'

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
