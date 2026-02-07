import type { HighlightGroup } from '@/lib/rhyme/highlightGroups'

export const RHYME_HIGHLIGHT_PALETTE = [
  '#60A5FA',
  '#F472B6',
  '#34D399',
  '#FBBF24',
  '#A78BFA',
  '#F87171',
  '#38BDF8',
  '#F97316',
  '#4ADE80',
  '#E879F9',
  '#2DD4BF',
  '#FACC15',
  '#FB7185',
  '#818CF8',
  '#22D3EE',
  '#C084FC',
]

export const applyAlpha = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const getPaletteColor = (index: number) => {
  if (!Number.isFinite(index)) return RHYME_HIGHLIGHT_PALETTE[0]
  return RHYME_HIGHLIGHT_PALETTE[Math.abs(index) % RHYME_HIGHLIGHT_PALETTE.length]
}

export const assignHighlightColors = (
  groups: HighlightGroup[],
  existing: Record<string, number>
) => {
  const nextMap: Record<string, number> = { ...existing }
  const usedIndices = Object.values(existing)
  let nextIndex = usedIndices.length ? Math.max(...usedIndices) + 1 : 0
  let didUpdate = false

  for (const group of groups) {
    if (nextMap[group.key] !== undefined) continue
    nextMap[group.key] = nextIndex
    nextIndex += 1
    didUpdate = true
  }

  return { map: nextMap, didUpdate }
}
