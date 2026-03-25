import { tokenizeLine, isWordLikeToken } from '@/lib/analysis/tokenize'
import { isStopword } from '@/lib/nlp/stopwords'
import type { LineInput } from '@/lib/analysis/compute'
import type { RhymeHighlightMode } from '@/lib/persist/schema'
import { getPronunciation, normalizeWord as normalizePronunciationWord } from '@/lib/phonetics/pronunciation'

export const RHYME_FAMILY_COLORS = [
  'rgba(222, 182, 96, 0.92)',  // warm yellow
  'rgba(114, 151, 196, 0.9)',  // muted blue
  'rgba(184, 126, 142, 0.9)',  // dusty rose
  'rgba(200, 145, 88, 0.9)',   // muted amber
  'rgba(129, 143, 160, 0.9)',  // cool slate
  'rgba(98, 157, 150, 0.9)',   // muted teal
  'rgba(156, 136, 199, 0.9)',  // soft violet
  'rgba(168, 120, 95, 0.9)',   // muted clay
]

export const DEFAULT_UNDERLINE_TARGETS = ['time', 'rhyme', 'line', 'flow']
export const MIN_FAMILY_SIZE = 2

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
  source?: 'override' | 'cmu' | 'heuristic'
  debugTitle?: () => string
}

export type RhymeDecorationSnapshot = {
  tokensByLine: Map<string, RhymeDecorationToken[]>
  familyCount: number
  tokenIdToFamilyId: Map<string, number>
  rhymeKeyToTokenIds: Map<string, string[]>
}

export const normalizeWord = (word: string) => normalizePronunciationWord(word)

export function getRhymeFamilyKey(word: string): string | null {
  const pronunciation = getPronunciation(word)
  return pronunciation.rhymeKey || null
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

/**
 * Compute rhyme-decoration tokens for each input line and group them into rhyme families for highlighting.
 *
 * @param lines - Array of input lines (each providing an `id` and `text`) to analyze for rhyme decorations
 * @param underlineTargets - Words to mark for underline; targets are normalized before matching
 * @param options - Behavior toggles:
 *   - `showInternalRhymes`: include non-final-word tokens when building rhyme families
 *   - `highlightStopwords`: include tokens that are stopwords when `true`
 * @returns A snapshot object containing:
 *   - `tokensByLine`: Map from `lineId` to an array of tokens with positional bounds, normalized word, rhyme metadata, and rendering hints
 *   - `familyCount`: number of rhyme families identified
 *   - `tokenIdToFamilyId`: Map from token id to assigned family id
 *   - `rhymeKeyToTokenIds`: Map from rhyme key to the list of token ids that share that rhyme key
 */
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
      const pronunciation = getPronunciation(token.analysisKey ?? token.text)
      const normalized = pronunciation.normalized
      if (!normalized) return
      if (!options.highlightStopwords && isStopword(normalized)) return
      const familyKey = pronunciation.rhymeKey
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
        source: pronunciation.source,
        debugTitle: () => `normalized: ${pronunciation.normalized}\nsyllables: ${pronunciation.syllables}\nsource: ${pronunciation.source}\nphones: ${pronunciation.phones.join(' ') || '(none)'}\nrhymeKey: ${pronunciation.rhymeKey}`,
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


export type ActiveRhymeSelection = {
  lineId: string
  caretOffset: number
}

/**
 * Determine which rhyme family should be considered active for a caret position on a given line.
 *
 * Chooses the token that contains the caret (start ≤ offset < end); if none, prefers a token whose boundary exactly matches the caret (offset === end or offset === start); if the caret is outside all tokens returns the first/last token's family or the nearest-left token's family as appropriate.
 *
 * @param snapshot - Snapshot containing `tokensByLine` for the target line
 * @param selection - Active line and caret offset; may be `null`
 * @returns The resolved `familyId` for the selection, or `null` if no applicable family is found
 */
export function resolveActiveRhymeFamilyId(
  snapshot: Pick<RhymeDecorationSnapshot, 'tokensByLine'>,
  selection: ActiveRhymeSelection | null
): number | null {
  if (!selection) return null
  const lineTokens = snapshot.tokensByLine.get(selection.lineId) ?? []
  if (!lineTokens.length) return null

  const sorted = [...lineTokens].sort((a, b) => a.start - b.start)

  const within = sorted.find((token) => selection.caretOffset >= token.start && selection.caretOffset < token.end)
  if (within) return within.familyId ?? null

  const rightEdge = sorted.find((token) => selection.caretOffset === token.end)
  if (rightEdge) return rightEdge.familyId ?? null

  const leftEdge = sorted.find((token) => selection.caretOffset === token.start)
  if (leftEdge) return leftEdge.familyId ?? null

  if (selection.caretOffset > sorted[sorted.length - 1].end) {
    return sorted[sorted.length - 1].familyId ?? null
  }

  if (selection.caretOffset < sorted[0].start) {
    return sorted[0].familyId ?? null
  }

  let nearestLeft: typeof sorted[number] | null = null
  for (const token of sorted) {
    if (token.end <= selection.caretOffset) {
      nearestLeft = token
      continue
    }
    break
  }

  return nearestLeft?.familyId ?? null
}

/**
 * Determine whether a rhyme token should be rendered given the current highlight mode and active family.
 *
 * @param tokenKey - Token metadata; `familyId` is undefined for tokens not assigned to a family, `isEndWord` marks line-final words
 * @param mode - Highlighting mode (`'off'`, `'all'`, `'end'`, `'focus'`)
 * @param activeFamilyId - Currently focused family id, or `null` when no family is active
 * @returns `true` if the token should be rendered, `false` otherwise
 */
export function shouldRenderRhymeToken(
  tokenKey: { familyId?: number; isEndWord: boolean },
  mode: RhymeHighlightMode,
  activeFamilyId: number | null
): boolean {
  if (mode === 'off') return false
  if (tokenKey.familyId === undefined) return false
  if (mode === 'all') return true
  if (mode === 'end') return tokenKey.isEndWord
  if (mode === 'focus') {
    if (activeFamilyId === null) return false
    return tokenKey.familyId === activeFamilyId
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
