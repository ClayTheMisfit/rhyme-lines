export type RhymeUnderlineStyle = 'solid' | 'dashed' | 'dotted'

export type RhymeFamilyStyle = {
  color: string
  lineStyle: RhymeUnderlineStyle
  thickness: number
}

export const RHYME_FAMILY_PALETTE: string[] = [
  'rgba(242, 201, 76, 0.95)',
  'rgba(94, 207, 255, 0.95)',
  'rgba(255, 138, 128, 0.95)',
  'rgba(132, 225, 138, 0.95)',
  'rgba(199, 146, 234, 0.95)',
  'rgba(255, 179, 102, 0.95)',
  'rgba(111, 222, 205, 0.95)',
  'rgba(255, 122, 162, 0.95)',
  'rgba(151, 180, 255, 0.95)',
  'rgba(196, 231, 114, 0.95)',
  'rgba(255, 161, 94, 0.95)',
  'rgba(122, 214, 255, 0.95)',
]

const OVERFLOW_LINE_STYLES: RhymeUnderlineStyle[] = ['solid', 'dashed', 'dotted']
const OVERFLOW_THICKNESS: number[] = [2, 2, 1.5]

const hashFamilyId = (familyId: number) => {
  const normalized = Number.isFinite(familyId) ? familyId : 0
  const int = Math.trunc(Math.abs(normalized))
  return (int * 2654435761) >>> 0
}

const assignUniquePaletteIndexes = (familyIds: number[]) => {
  const used = new Set<number>()
  const paletteIndexes = new Map<number, number>()

  familyIds.forEach((familyId, index) => {
    const preferred = hashFamilyId(familyId) % RHYME_FAMILY_PALETTE.length

    if (index < RHYME_FAMILY_PALETTE.length) {
      let slot = preferred
      for (let attempts = 0; attempts < RHYME_FAMILY_PALETTE.length; attempts += 1) {
        if (!used.has(slot)) {
          used.add(slot)
          paletteIndexes.set(familyId, slot)
          return
        }
        slot = (slot + 1) % RHYME_FAMILY_PALETTE.length
      }
    }

    paletteIndexes.set(familyId, preferred)
  })

  return paletteIndexes
}

export function buildRhymeFamilyStyleMap(visibleFamilyIds: number[]): Map<number, RhymeFamilyStyle> {
  const normalized = Array.from(new Set(visibleFamilyIds.filter((id) => Number.isFinite(id)))).sort((a, b) => a - b)
  const paletteIndexes = assignUniquePaletteIndexes(normalized)
  const styles = new Map<number, RhymeFamilyStyle>()

  normalized.forEach((familyId, index) => {
    const paletteIndex = paletteIndexes.get(familyId) ?? 0
    const overflowTier = Math.floor(index / RHYME_FAMILY_PALETTE.length)
    const tierIndex = overflowTier % OVERFLOW_LINE_STYLES.length
    styles.set(familyId, {
      color: RHYME_FAMILY_PALETTE[paletteIndex],
      lineStyle: OVERFLOW_LINE_STYLES[tierIndex],
      thickness: OVERFLOW_THICKNESS[tierIndex],
    })
  })

  return styles
}
