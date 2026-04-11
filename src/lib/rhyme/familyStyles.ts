export type RhymeUnderlineStyle = 'solid' | 'dashed' | 'double'

export type RhymeFamilyStyle = {
  color: string
  lineStyle: RhymeUnderlineStyle
  thickness: number
}

// Curated categorical palette for dark-editor readability.
export const RHYME_FAMILY_PALETTE = [
  '#F59E0B', // amber
  '#22C55E', // green
  '#38BDF8', // sky
  '#EF4444', // red
  '#A78BFA', // violet
  '#14B8A6', // teal
  '#F97316', // orange
  '#E879F9', // fuchsia
  '#84CC16', // lime
  '#60A5FA', // blue
  '#FB7185', // rose
  '#FACC15', // yellow
] as const

// Contrast-jump ordering to avoid neighboring hues landing together.
const PALETTE_ORDER = [0, 4, 1, 7, 2, 9, 3, 10, 5, 11, 6, 8] as const

const OVERFLOW_STYLES: Array<Pick<RhymeFamilyStyle, 'lineStyle' | 'thickness'>> = [
  { lineStyle: 'solid', thickness: 2 },
  { lineStyle: 'solid', thickness: 2.5 },
  { lineStyle: 'dashed', thickness: 2 },
  { lineStyle: 'double', thickness: 3 },
]

const hashFamilyId = (familyId: number) => {
  const normalized = Number.isFinite(familyId) ? Math.trunc(Math.abs(familyId)) : 0
  return (normalized * 2654435761) >>> 0
}

const assignPaletteSlots = (familyIds: number[]) => {
  const used = new Set<number>()
  const slots = new Map<number, number>()
  const capacity = RHYME_FAMILY_PALETTE.length

  familyIds.forEach((familyId, index) => {
    const start = hashFamilyId(familyId) % capacity

    if (index < capacity) {
      for (let attempt = 0; attempt < capacity; attempt += 1) {
        const candidate = PALETTE_ORDER[(start + attempt) % capacity]
        if (!used.has(candidate)) {
          used.add(candidate)
          slots.set(familyId, candidate)
          return
        }
      }
    }

    slots.set(familyId, PALETTE_ORDER[start])
  })

  return slots
}

export function buildRhymeFamilyStyleMap(visibleFamilyIds: number[]): Map<number, RhymeFamilyStyle> {
  const normalized = Array.from(new Set(visibleFamilyIds.filter((id) => Number.isFinite(id)))).sort((a, b) => a - b)
  const paletteSlots = assignPaletteSlots(normalized)
  const styles = new Map<number, RhymeFamilyStyle>()

  normalized.forEach((familyId, index) => {
    const overflowTier = Math.floor(index / RHYME_FAMILY_PALETTE.length)
    const styleTier = OVERFLOW_STYLES[overflowTier % OVERFLOW_STYLES.length]
    const slot = paletteSlots.get(familyId) ?? 0

    styles.set(familyId, {
      color: RHYME_FAMILY_PALETTE[slot],
      lineStyle: styleTier.lineStyle,
      thickness: styleTier.thickness,
    })
  })

  return styles
}
