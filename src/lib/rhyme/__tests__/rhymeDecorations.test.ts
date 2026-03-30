import { tokenizeLine, isWordLikeToken } from '@/lib/analysis/tokenize'
import {
  buildRhymeDecorations,
  computeRhymeFamilies,
  getEndWordTokenIndex,
  getRhymeFamilyKey,
  normalizeWord,
  resolveActiveRhymeFamilyId,
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

  it('highlights the full rhyme family for the active line text', () => {
    const lines = [{ id: 'line-0', text: 'mat cat hat rat' }]
    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: true, highlightStopwords: false })
    const tokens = result.tokensByLine.get('line-0') ?? []

    expect(tokens).toHaveLength(4)
    expect(tokens.every((token) => token.familyId !== undefined)).toBe(true)
    expect(new Set(tokens.map((token) => token.familyId)).size).toBe(1)
  })

  it.each([
    'test best rest',
    'mat cat rat',
    'glow snow show',
    'stone alone phone',
    'light night sight',
    'keep deep sleep',
    'crash ash stash',
  ])('groups common rhyme families for "%s"', (text) => {
    const lines = [{ id: 'line-0', text }]
    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: true, highlightStopwords: false })
    const tokens = result.tokensByLine.get('line-0') ?? []

    expect(tokens.length).toBe(text.split(/\s+/).length)
    expect(tokens.every((token) => token.familyId !== undefined)).toBe(true)
    expect(new Set(tokens.map((token) => token.familyId)).size).toBe(1)
  })

  it('does not flatten unrelated terminal-y words into one family', () => {
    const lines = [{ id: 'line-0', text: 'my dry happy' }]
    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: true, highlightStopwords: true })
    const tokens = result.tokensByLine.get('line-0') ?? []

    expect(tokens).toHaveLength(3)
    expect(new Set(tokens.map((token) => token.familyKey)).size).toBeGreaterThan(1)
  })

  it('groups short one-syllable terminal-y rhymes together', () => {
    const lines = [{ id: 'line-0', text: 'dry my try fly cry' }]
    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: true, highlightStopwords: true })
    const tokens = result.tokensByLine.get('line-0') ?? []

    expect(tokens).toHaveLength(5)
    expect(tokens.every((token) => token.familyId !== undefined)).toBe(true)
    expect(new Set(tokens.map((token) => token.familyId)).size).toBe(1)
  })

  it('groups punctuation/casing variants for common fallback families', () => {
    const lines = [{ id: 'line-0', text: 'Glow, SNOW! show?' }]
    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: true, highlightStopwords: false })
    const tokens = result.tokensByLine.get('line-0') ?? []

    expect(tokens).toHaveLength(3)
    expect(tokens.every((token) => token.familyId !== undefined)).toBe(true)
    expect(new Set(tokens.map((token) => token.familyId)).size).toBe(1)
  })

  it('keeps expected family grouping across mixed-layout regression block', () => {
    const lines = [
      { id: 'line-0', text: 'mat cat rat' },
      { id: 'line-1', text: 'glow snow show' },
      { id: 'line-2', text: 'stone alone phone' },
      { id: 'line-3', text: 'light night sight' },
      { id: 'line-4', text: 'keep deep sleep' },
      { id: 'line-5', text: 'test best rest' },
    ]
    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: true, highlightStopwords: false })

    for (const line of lines) {
      const tokens = result.tokensByLine.get(line.id) ?? []
      expect(tokens).toHaveLength(3)
      expect(tokens.every((token) => token.familyId !== undefined)).toBe(true)
      expect(new Set(tokens.map((token) => token.familyId)).size).toBe(1)
    }
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


describe('active family resolution', () => {
  it('recomputes the active family from the current caret word', () => {
    const lines = [
      { id: 'line-0', text: 'mat cat hat rat' },
      { id: 'line-1', text: 'time fine rhyme' },
    ]
    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: true, highlightStopwords: false })

    const line0Cat = (result.tokensByLine.get('line-0') ?? []).find((token) => token.word === 'cat')
    const line1Time = (result.tokensByLine.get('line-1') ?? []).find((token) => token.word === 'time')

    expect(line0Cat).toBeDefined()
    expect(line1Time).toBeDefined()

    const firstFamily = resolveActiveRhymeFamilyId(result, { lineId: 'line-0', caretOffset: line0Cat!.start + 1 })
    const nextFamily = resolveActiveRhymeFamilyId(result, { lineId: 'line-1', caretOffset: line1Time!.start + 1 })

    expect(firstFamily).toBe(line0Cat!.familyId)
    expect(nextFamily).toBe(line1Time!.familyId)
    expect(firstFamily).not.toBe(nextFamily)
  })

  it('returns null when caret moves to a non-rhyme token span', () => {
    const lines = [{ id: 'line-0', text: 'cat hat' }]
    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: true, highlightStopwords: false })

    const family = resolveActiveRhymeFamilyId(result, { lineId: 'line-0', caretOffset: 3 })
    expect(family).not.toBeNull()

    const stale = resolveActiveRhymeFamilyId(result, { lineId: 'line-0', caretOffset: 4 })
    expect(stale).toBe(family)

    const missing = resolveActiveRhymeFamilyId(result, { lineId: 'line-404', caretOffset: 1 })
    expect(missing).toBeNull()
  })

  it('resolves boundary and end-of-line caret positions to the intended token family', () => {
    const lines = [{ id: 'line-0', text: 'tag bag flag rag gag wag' }]
    const result = buildRhymeDecorations(lines, [], { showInternalRhymes: true, highlightStopwords: false })
    const tokens = result.tokensByLine.get('line-0') ?? []
    const wag = tokens.find((token) => token.word === 'wag')
    const bag = tokens.find((token) => token.word === 'bag')

    expect(wag).toBeDefined()
    expect(bag).toBeDefined()
    expect(new Set(tokens.map((token) => token.familyId)).size).toBe(1)

    const insideWag = resolveActiveRhymeFamilyId(result, { lineId: 'line-0', caretOffset: wag!.start + 1 })
    const wagEnd = resolveActiveRhymeFamilyId(result, { lineId: 'line-0', caretOffset: wag!.end })
    const afterWag = resolveActiveRhymeFamilyId(result, { lineId: 'line-0', caretOffset: wag!.end + 1 })
    const bagLeftEdge = resolveActiveRhymeFamilyId(result, { lineId: 'line-0', caretOffset: bag!.start })

    expect(insideWag).toBe(wag!.familyId)
    expect(wagEnd).toBe(wag!.familyId)
    expect(afterWag).toBe(wag!.familyId)
    expect(bagLeftEdge).toBe(bag!.familyId)
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
    expect(shouldRenderRhymeToken({ ...sample, isEndWord: true }, 'focus', 1)).toBe(false)
  })
})
