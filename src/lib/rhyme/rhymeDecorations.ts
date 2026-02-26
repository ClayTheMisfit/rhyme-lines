import { tokenizeLine, isWordLikeToken } from '@/lib/analysis/tokenize'
import { isStopword } from '@/lib/nlp/stopwords'
import type { LineInput } from '@/lib/analysis/compute'

export const RHYME_FAMILY_COLORS = [
  'rgba(248, 113, 113, 0.22)',
  'rgba(250, 204, 21, 0.2)',
  'rgba(52, 211, 153, 0.2)',
  'rgba(96, 165, 250, 0.22)',
  'rgba(167, 139, 250, 0.22)',
  'rgba(244, 114, 182, 0.2)',
  'rgba(251, 146, 60, 0.2)',
  'rgba(148, 163, 184, 0.2)',
]

export const DEFAULT_UNDERLINE_TARGETS = ['time', 'rhyme', 'line', 'flow']
export const MIN_FAMILY_SIZE = 2

const RHYME_TAIL_REGEX = /([aeiouy]+[^aeiouy]*)$/i

export type RhymeHighlightMode = 'off' | 'end' | 'focus' | 'all'

export type RhymeDecorationToken = {
  id: string
  lineId: string
  lineIndex: number
  start: number
  end: number
  word: string
  familyKey: string
  familyId?: number
  colorIndex?: number
  underline: boolean
  isEndWord: boolean
}

export type RhymeDecorationSnapshot = {
  tokensByLine: Map<string, RhymeDecorationToken[]>
  familyCount: number
  tokenIdToFamilyId: Map<string, number>
  rhymeKeyToTokenIds: Map<string, string[]>
}

export const normalizeWord = (word: string) =>
  word
    .toLowerCase()
    .replace(/[^a-z']/g, '')
    .replace(/^'+|'+$/g, '')

export function getRhymeFamilyKey(word: string): string | null {
  const normalized = normalizeWord(word)
  if (!normalized) return null
  const match = normalized.match(RHYME_TAIL_REGEX)
  if (match?.[1]) return match[1]
  if (normalized.length <= 2) return normalized
  return normalized.slice(-2)
}

export function getEndWordTokenIndex(tokens: ReturnType<typeof tokenizeLine>): number | null {
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (isWordLikeToken(tokens[index])) return index
  }
  return null
}

export function computeRhymeFamilies(tokens: Array<{ id: string; rhymeKey: string }>): {
  familyIdByTokenId: Map<string, number>
  familyIdByRhymeKey: Map<string, number>
  rhymeKeyToTokenIds: Map<string, string[]>
} {
  const rhymeKeyToTokenIds = new Map<string, string[]>()

  tokens.forEach((token) => {
    const existing = rhymeKeyToTokenIds.get(token.rhymeKey)
    if (existing) {
      existing.push(token.id)
    } else {
      rhymeKeyToTokenIds.set(token.rhymeKey, [token.id])
    }
  })

  const familyIdByTokenId = new Map<string, number>()
  const familyIdByRhymeKey = new Map<string, number>()
  let nextFamilyId = 0

  for (const [rhymeKey, tokenIds] of rhymeKeyToTokenIds.entries()) {
    if (tokenIds.length < MIN_FAMILY_SIZE) continue
    const familyId = nextFamilyId++
    familyIdByRhymeKey.set(rhymeKey, familyId)
    tokenIds.forEach((tokenId) => {
      familyIdByTokenId.set(tokenId, familyId)
    })
  }

  return { familyIdByTokenId, familyIdByRhymeKey, rhymeKeyToTokenIds }
}

export function buildRhymeDecorations(
  lines: LineInput[],
  underlineTargets: string[],
  options: { showInternalRhymes: boolean; highlightStopwords: boolean }
): RhymeDecorationSnapshot {
  const tokensByLine = new Map<string, RhymeDecorationToken[]>()
  const underlineSet = new Set(underlineTargets.map((target) => normalizeWord(target)))
  const allTokens: Array<{ id: string; rhymeKey: string }> = []

  lines.forEach((line, lineIndex) => {
    const tokens = tokenizeLine(line.text)
    const endWordIndex = getEndWordTokenIndex(tokens)
    const lineTokens: RhymeDecorationToken[] = []
    tokens.forEach((token, tokenIndex) => {
      if (!isWordLikeToken(token)) return
      const normalized = normalizeWord(token.analysisKey ?? token.text)
      if (!normalized) return
      if (!options.highlightStopwords && isStopword(normalized)) return
      const familyKey = getRhymeFamilyKey(normalized)
      if (!familyKey) return
      const tokenId = `${line.id}-${tokenIndex}`
      const isEndWord = tokenIndex === endWordIndex
      if (options.showInternalRhymes || isEndWord) {
        allTokens.push({ id: tokenId, rhymeKey: familyKey })
      }
      lineTokens.push({
        id: tokenId,
        lineId: line.id,
        lineIndex,
        start: token.start,
        end: token.end,
        word: normalized,
        familyKey,
        underline: underlineSet.has(normalized),
        isEndWord,
      })
    })
    tokensByLine.set(line.id, lineTokens)
  })

  const { familyIdByTokenId, familyIdByRhymeKey, rhymeKeyToTokenIds } = computeRhymeFamilies(allTokens)
  tokensByLine.forEach((lineTokens) => {
    lineTokens.forEach((token) => {
      token.familyId = familyIdByTokenId.get(token.id)
      token.colorIndex = hashToColorIndex(token.familyKey)
    })
  })

  return {
    tokensByLine,
    familyCount: familyIdByRhymeKey.size,
    tokenIdToFamilyId: familyIdByTokenId,
    rhymeKeyToTokenIds,
  }
}

export function shouldRenderRhymeToken(
  token: RhymeDecorationToken,
  mode: RhymeHighlightMode,
  activeFamilyId: number | null
): boolean {
  if (mode === 'off') return false
  if (token.familyId === undefined) return false
  if (mode === 'all') return true
  if (mode === 'end') return token.isEndWord
  if (mode === 'focus') {
    if (token.isEndWord) return true
    if (activeFamilyId === null) return false
    return token.familyId === activeFamilyId
  }
  return false
}

function hashToColorIndex(key: string): number {
  let hash = 0
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}
