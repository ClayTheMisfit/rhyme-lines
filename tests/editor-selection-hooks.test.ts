import { restoreSelection, serializeSelection } from '@/editor'

describe('selection serialization and restoration', () => {
  function mount(lines: string[]) {
    const root = document.createElement('div')
    root.innerHTML = lines
      .map((line, index) => `<div class="line" data-line-id="line-${index}">${line}</div>`)
      .join('')
    document.body.appendChild(root)
    return root
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('serializes collapsed caret in middle of word', () => {
    const root = mount(['hello world'])
    const textNode = root.querySelector('.line')?.firstChild as Text
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(textNode, 3)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)

    const snapshot = serializeSelection(root, selection)
    expect(snapshot?.isCollapsed).toBe(true)
    expect(snapshot?.anchor.lineId).toBe('line-0')
    expect(snapshot?.anchor.offset).toBe(3)
  })

  test('serializes selection spanning multiple lines', () => {
    const root = mount(['hello', 'world'])
    const line0 = root.querySelector('[data-line-id="line-0"]')!.firstChild as Text
    const line1 = root.querySelector('[data-line-id="line-1"]')!.firstChild as Text
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(line0, 1)
    range.setEnd(line1, 3)
    selection.removeAllRanges()
    selection.addRange(range)

    const snapshot = serializeSelection(root, selection)
    expect(snapshot?.anchor.lineId).toBe('line-0')
    expect(snapshot?.focus.lineId).toBe('line-1')
  })

  test('restores after dom rebuild', () => {
    const root = mount(['alpha beta'])
    const textNode = root.querySelector('.line')!.firstChild as Text
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(textNode, 6)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)

    const snapshot = serializeSelection(root, selection)
    root.innerHTML = `<div class="line" data-line-id="line-0">alpha beta</div>`

    expect(restoreSelection(root, snapshot)).toBe(true)
    const current = window.getSelection()!
    expect(current.anchorOffset).toBe(6)
  })
})
