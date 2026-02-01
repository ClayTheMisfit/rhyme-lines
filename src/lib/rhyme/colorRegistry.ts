import type { HighlightGroup } from '@/lib/rhyme/highlight'
import { stableHash } from '@/lib/rhyme/highlight'

export type ColorAssignment = {
  id: number
  color: string
  isGenerated: boolean
}

const STALE_TICK_LIMIT = 6

// UI integration: keep assignments stable across analyses without worker involvement.
const buildGeneratedColor = (hue: number) =>
  `hsla(${hue}, var(--rl-rhyme-generated-saturation), var(--rl-rhyme-generated-lightness), var(--rl-rhyme-alpha))`

export class ColorRegistry {
  private map = new Map<string, ColorAssignment & { lastSeen: number }>()
  private tick = 0

  update(groups: HighlightGroup[], palette: string[]) {
    this.tick += 1
    const usedPaletteIds = new Set<number>()
    const usedGeneratedColors = new Set<string>()
    const assignments = new Map<string, ColorAssignment>()
    const paletteSize = palette.length
    const usedHueOffsets = [0, 29, 59, 89, 121, 151, 181, 211, 241, 271, 301, 331]

    const nextPaletteId = () => {
      for (let index = 0; index < paletteSize; index += 1) {
        if (!usedPaletteIds.has(index)) return index
      }
      return null
    }

    for (const group of groups) {
      const existing = this.map.get(group.key)
      if (existing && !existing.isGenerated && existing.id < paletteSize && !usedPaletteIds.has(existing.id)) {
        existing.lastSeen = this.tick
        usedPaletteIds.add(existing.id)
        assignments.set(group.key, { id: existing.id, color: palette[existing.id], isGenerated: false })
        continue
      }

      if (existing && existing.isGenerated) {
        if (!usedGeneratedColors.has(existing.color)) {
          usedGeneratedColors.add(existing.color)
          existing.lastSeen = this.tick
          assignments.set(group.key, { id: existing.id, color: existing.color, isGenerated: true })
          continue
        }
      }

      const paletteId = nextPaletteId()
      if (paletteId !== null) {
        const entry = { id: paletteId, color: palette[paletteId], isGenerated: false, lastSeen: this.tick }
        this.map.set(group.key, entry)
        usedPaletteIds.add(paletteId)
        assignments.set(group.key, { id: entry.id, color: entry.color, isGenerated: false })
        continue
      }

      const baseHue = Math.abs(stableHash(group.key)) % 360
      let generated = buildGeneratedColor(baseHue)
      for (const offset of usedHueOffsets) {
        const candidate = buildGeneratedColor((baseHue + offset) % 360)
        if (!usedGeneratedColors.has(candidate)) {
          generated = candidate
          break
        }
      }
      const entry = { id: paletteSize, color: generated, isGenerated: true, lastSeen: this.tick }
      this.map.set(group.key, entry)
      usedGeneratedColors.add(generated)
      assignments.set(group.key, { id: entry.id, color: entry.color, isGenerated: true })
    }

    for (const [key, entry] of this.map.entries()) {
      if (this.tick - entry.lastSeen > STALE_TICK_LIMIT) {
        this.map.delete(key)
      }
    }

    return assignments
  }
}
