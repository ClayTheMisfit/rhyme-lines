import { buildRhymeFamilyStyleMap, RHYME_FAMILY_PALETTE } from '@/lib/rhyme/familyStyles'

describe('buildRhymeFamilyStyleMap', () => {
  it('is deterministic for the same visible family set', () => {
    const first = buildRhymeFamilyStyleMap([8, 3, 15, 3, 2])
    const second = buildRhymeFamilyStyleMap([15, 2, 8, 3])

    expect(Array.from(first.entries())).toEqual(Array.from(second.entries()))
  })

  it('assigns unique primary colors while visible family count is within palette capacity', () => {
    const ids = Array.from({ length: RHYME_FAMILY_PALETTE.length }, (_, index) => index)
    const styleMap = buildRhymeFamilyStyleMap(ids)
    const assignedColors = ids.map((id) => styleMap.get(id)?.color)

    expect(new Set(assignedColors).size).toBe(RHYME_FAMILY_PALETTE.length)
  })

  it('falls back to secondary style channels once palette capacity is exceeded', () => {
    const ids = Array.from({ length: RHYME_FAMILY_PALETTE.length + 3 }, (_, index) => index)
    const styleMap = buildRhymeFamilyStyleMap(ids)

    const overflowStyles = ids
      .slice(RHYME_FAMILY_PALETTE.length)
      .map((id) => styleMap.get(id)?.lineStyle)

    expect(overflowStyles.every((lineStyle) => lineStyle === 'dashed')).toBe(true)
  })

  it('keeps overflow assignments stable across re-renders', () => {
    const ids = Array.from({ length: RHYME_FAMILY_PALETTE.length + 6 }, (_, index) => index * 2)
    const first = buildRhymeFamilyStyleMap(ids)
    const second = buildRhymeFamilyStyleMap(ids)

    ids.forEach((id) => {
      expect(first.get(id)).toEqual(second.get(id))
    })
  })
})
