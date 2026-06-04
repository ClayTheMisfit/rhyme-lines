import {
  getActiveTokenFromCaret,
  getEditorPlainText,
  getEditorPlainTextIndexFromSelection,
  getLinePlainText,
} from '@/lib/editor/plainText'
import { serializeFromEditor } from '@/lib/editor/serialization'
import { serializeSelection } from '@/editor/selection/serializeSelection'
import { restoreSelection } from '@/editor/selection/restoreSelection'

const createDecoratedEditor = () => {
  const root = document.createElement('div')
  root.id = 'lyric-editor'
  root.contentEditable = 'true'
  const line = document.createElement('div')
  line.className = 'line'
  line.dataset.lineId = 'line-1'
  const grayBadge = document.createElement('span')
  grayBadge.dataset.syllableBadge = 'true'
  grayBadge.setAttribute('aria-hidden', 'true')
  grayBadge.contentEditable = 'false'
  grayBadge.textContent = '1'
  const awayBadge = document.createElement('span')
  awayBadge.dataset.syllableBadge = 'true'
  awayBadge.setAttribute('aria-hidden', 'true')
  awayBadge.contentEditable = 'false'
  awayBadge.textContent = '2'
  const grayNode = document.createTextNode('gray ')
  const awayNode = document.createTextNode('away')
  line.append(grayBadge, grayNode, awayBadge, awayNode)
  root.appendChild(line)
  document.body.appendChild(root)
  return { root, line, grayNode, awayNode }
}

const setCaret = (node: Node, offset: number) => {
  const selection = window.getSelection()!
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  return selection
}

describe('editor plain text extraction', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  it('extracts canonical lyric text without visual syllable badge text', () => {
    const { root, line } = createDecoratedEditor()

    expect(root.textContent?.replace(/\s+/g, ' ').trim()).toBe('1gray 2away')
    expect(getLinePlainText(line).trim()).toBe('gray away')
    expect(getEditorPlainText(root).trim()).toBe('gray away')
    expect(serializeFromEditor(root).trim()).toBe('gray away')
  })

  it.each([
    ['|gray away', 0, 'gray'],
    ['gr|ay away', 2, 'gray'],
    ['gray| away', 4, 'gray'],
    ['gray |away', 5, 'away'],
    ['gray aw|ay', 7, 'away'],
    ['gray away|', 9, 'away'],
  ])('maps caret position %s to the clean active token', (_label, offset, expected) => {
    const root = document.createElement('div')
    root.contentEditable = 'true'
    root.innerHTML = '<div class="line" data-line-id="line-1">gray away</div>'
    document.body.appendChild(root)
    const textNode = root.querySelector('.line')!.firstChild as Text
    const selection = setCaret(textNode, offset)

    expect(getActiveTokenFromCaret(selection, root)?.word).toBe(expected)
    expect(getEditorPlainTextIndexFromSelection(root, selection)?.lineOffset).toBe(offset)
  })

  it('maps decorated caret offsets and status columns using clean lyric text only', () => {
    const { root, awayNode } = createDecoratedEditor()
    const selection = setCaret(awayNode, 4)

    expect(getEditorPlainText(root).trim()).toBe('gray away')
    expect(getActiveTokenFromCaret(selection, root)?.word).toBe('away')
    expect(getEditorPlainTextIndexFromSelection(root, selection)?.lineOffset).toBe(9)
    expect((getEditorPlainTextIndexFromSelection(root, selection)?.lineOffset ?? 0) + 1).toBe(10)
  })

  it('serializes and restores selections without counting badge text', () => {
    const { root, awayNode } = createDecoratedEditor()
    setCaret(awayNode, 2)

    const snapshot = serializeSelection(root, window.getSelection())
    expect(snapshot?.focus.offset).toBe(7)

    window.getSelection()?.removeAllRanges()
    expect(restoreSelection(root, snapshot)).toBe(true)

    const restored = window.getSelection()!
    expect(getActiveTokenFromCaret(restored, root)?.word).toBe('away')
    expect(getEditorPlainTextIndexFromSelection(root, restored)?.lineOffset).toBe(7)
  })
})
