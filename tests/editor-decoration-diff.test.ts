import { diffDecorations } from '@/editor'

describe('diffDecorations', () => {
  test('no-op diff emits no operations', () => {
    const prev = new Map([['line-1', [{ id: 'a', start: 0, end: 1 }]]])
    const next = new Map([['line-1', [{ id: 'a', start: 0, end: 1 }]]])
    expect(diffDecorations(prev, next)).toEqual([])
  })

  test('add/remove/update operations', () => {
    const prev = new Map([
      ['line-1', [{ id: 'a', start: 0, end: 1 }]],
      ['line-2', [{ id: 'b', start: 0, end: 1 }]],
    ])
    const next = new Map([
      ['line-1', [{ id: 'a', start: 0, end: 2 }]],
      ['line-3', [{ id: 'c', start: 0, end: 1 }]],
    ])
    const patch = diffDecorations(prev, next)
    expect(patch).toEqual(
      expect.arrayContaining([
        { type: 'update', lineId: 'line-1', decorations: [{ id: 'a', start: 0, end: 2 }] },
        { type: 'remove', lineId: 'line-2' },
        { type: 'add', lineId: 'line-3', decorations: [{ id: 'c', start: 0, end: 1 }] },
      ])
    )
  })
})
