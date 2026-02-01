import { ColorRegistry } from '@/lib/rhyme/colorRegistry'
import type { HighlightGroup } from '@/lib/rhyme/highlight'

const palette = ['c0', 'c1', 'c2']

const group = (key: string, order: number): HighlightGroup => ({
  key,
  tokenIds: ['t1', 't2'],
  kind: 'perfect',
  order,
})

describe('ColorRegistry', () => {
  it('assigns unique color ids for groups', () => {
    const registry = new ColorRegistry()
    const groups = [group('rhyme:a', 0), group('rhyme:b', 1), group('rhyme:c', 2)]
    const assignments = registry.update(groups, palette)
    const colors = new Set(Array.from(assignments.values()).map((assignment) => assignment.color))
    expect(colors.size).toBe(groups.length)
  })

  it('keeps colors stable across reordered input', () => {
    const registry = new ColorRegistry()
    const groups = [group('rhyme:a', 0), group('rhyme:b', 1), group('rhyme:c', 2)]
    const first = registry.update(groups, palette)
    const reordered = [group('rhyme:c', 2), group('rhyme:a', 0), group('rhyme:b', 1)]
    const second = registry.update(reordered, palette)
    expect(second.get('rhyme:a')?.color).toBe(first.get('rhyme:a')?.color)
    expect(second.get('rhyme:b')?.color).toBe(first.get('rhyme:b')?.color)
    expect(second.get('rhyme:c')?.color).toBe(first.get('rhyme:c')?.color)
  })

  it('adds new groups without reshuffling existing colors', () => {
    const registry = new ColorRegistry()
    const groups = [group('rhyme:a', 0), group('rhyme:b', 1)]
    const first = registry.update(groups, palette)
    const second = registry.update([...groups, group('rhyme:c', 2)], palette)
    expect(second.get('rhyme:a')?.color).toBe(first.get('rhyme:a')?.color)
    expect(second.get('rhyme:b')?.color).toBe(first.get('rhyme:b')?.color)
    expect(second.get('rhyme:c')).toBeDefined()
  })

  it('reuses previous color when possible after removal', () => {
    const registry = new ColorRegistry()
    const first = registry.update([group('rhyme:a', 0), group('rhyme:b', 1)], palette)
    registry.update([group('rhyme:a', 0)], palette)
    const third = registry.update([group('rhyme:a', 0), group('rhyme:b', 1)], palette)
    expect(third.get('rhyme:b')?.color).toBe(first.get('rhyme:b')?.color)
  })
})
