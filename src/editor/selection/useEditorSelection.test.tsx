import { act, renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { useEditorSelection } from './useEditorSelection'

function setCaret(node: Node, offset: number) {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
}

function setupEditor() {
  const editor = document.createElement('div')
  editor.innerHTML = '<div class="line" data-line-id="line-1">first word</div><div class="line" data-line-id="line-2">second dream</div>'
  document.body.appendChild(editor)
  const externalButton = document.createElement('button')
  externalButton.textContent = 'Explore Meanings'
  document.body.appendChild(externalButton)
  return { editor, externalButton }
}

describe('useEditorSelection', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.getSelection()?.removeAllRanges()
  })

  it('retains the last valid editor snapshot while focus moves outside and updates again on real editor selection changes', () => {
    const { editor, externalButton } = setupEditor()
    const ref = createRef<HTMLDivElement>()
    ref.current = editor
    const onSelectionChange = jest.fn()
    const { result } = renderHook(() => useEditorSelection({ editorRef: ref, onSelectionChange }))

    const firstLineText = editor.querySelectorAll('.line')[0].firstChild as Text
    const secondLineText = editor.querySelectorAll('.line')[1].firstChild as Text

    act(() => setCaret(secondLineText, 'second dream'.length))
    expect(result.current.getSnapshot()).toMatchObject({
      anchor: { lineId: 'line-2', offset: 12 },
      focus: { lineId: 'line-2', offset: 12 },
      isCollapsed: true,
    })
    expect(result.current.snapshotRef.current).toMatchObject({ focus: { lineId: 'line-2', offset: 12 } })

    act(() => setCaret(externalButton.firstChild as Text, 'Explore'.length))
    expect(result.current.getSnapshot()).toBeNull()
    expect(result.current.snapshotRef.current).toMatchObject({ focus: { lineId: 'line-2', offset: 12 } })

    act(() => setCaret(firstLineText, 'first'.length))
    expect(result.current.snapshotRef.current).toMatchObject({ focus: { lineId: 'line-1', offset: 5 } })
  })
})
