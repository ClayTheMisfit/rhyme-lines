import { tokenizeLine, isWordLikeToken } from '@/lib/analysis/tokenize'
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

const RHYME_TAIL_REGEX = /([aeiouy]+[^aeiouy]*)$/i

export type RhymeDecorationToken = {
  id: string
  lineId: string
  lineIndex: number
  start: number
  end: number
  word: string
  familyKey: string
  familyIndex: number
  underline: boolean
}

export type RhymeDecorationSnapshot = {
  tokensByLine: Map<string, RhymeDecorationToken[]>
  familyCount: number
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

export function buildRhymeDecorations(
  lines: LineInput[],
  underlineTargets: string[]
): RhymeDecorationSnapshot {
  const tokensByLine = new Map<string, RhymeDecorationToken[]>()
  const familyIndexByKey = new Map<string, number>()
  const underlineSet = new Set(underlineTargets.map((target) => normalizeWord(target)))

  lines.forEach((line, lineIndex) => {
    const tokens = tokenizeLine(line.text)
    const lineTokens: RhymeDecorationToken[] = []
    tokens.forEach((token, tokenIndex) => {
      if (!isWordLikeToken(token.text)) return
      const normalized = normalizeWord(token.text)
      if (!normalized) return
      const familyKey = getRhymeFamilyKey(normalized)
      if (!familyKey) return
      let familyIndex = familyIndexByKey.get(familyKey)
      if (familyIndex === undefined) {
        familyIndex = familyIndexByKey.size
        familyIndexByKey.set(familyKey, familyIndex)
      }
      lineTokens.push({
        id: `${line.id}-${tokenIndex}`,
        lineId: line.id,
        lineIndex,
        start: token.start,
        end: token.end,
        word: normalized,
        familyKey,
        familyIndex,
        underline: underlineSet.has(normalized),
      })
    })
    tokensByLine.set(line.id, lineTokens)
  })

  return {
    tokensByLine,
    familyCount: familyIndexByKey.size,
  }
}
