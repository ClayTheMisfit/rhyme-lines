import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import RhymePanel from './RhymePanel'
import { getEditorPlainTextIndexFromSelection } from '@/lib/editor/plainText'

jest.mock('./rhyme/RhymeSuggestionsPanel', () => ({
  RhymeSuggestionsPanel: ({ caretIndex, currentLineText, onClose }: { caretIndex: number; currentLineText: string; onClose: () => void }) => (
    <div>
      <div data-testid="caret-index">{caretIndex}</div>
      <div data-testid="current-line">{currentLineText}</div>
      <button onClick={onClose}>Explore Meanings</button>
    </div>
  ),
}))

function installEditor() {
  document.body.innerHTML = '<section class="editor-surface"><div id="lyric-editor" contenteditable="true"><div class="line" data-line-id="line-1">first word on line one</div><div class="line" data-line-id="line-2">second line ends with dream</div><div class="line" data-line-id="line-3">third line stays here</div></div></section><button>Outside</button>'
  return document.getElementById('lyric-editor') as HTMLElement
}

function setCaret(node: Node, offset: number) {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
}

describe('RhymePanel editor snapshot', () => {
  beforeEach(() => {
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    document.body.innerHTML = ''
    document.getSelection()?.removeAllRanges()
  })

  it('keeps the last valid caret and line target when panel controls receive focus', async () => {
    const editor = installEditor()
    const secondLineText = editor.querySelectorAll('.line')[1].firstChild as Text
    act(() => setCaret(secondLineText, 'second line ends with dream'.length))
    const originalCaret = getEditorPlainTextIndexFromSelection(editor, document.getSelection())?.index
    expect(originalCaret).toBeGreaterThan(0)

    render(<RhymePanel />)
    await waitFor(() => expect(screen.getByTestId('caret-index')).toHaveTextContent(String(originalCaret)))
    expect(screen.getByTestId('current-line')).toHaveTextContent('second line ends with dream')

    act(() => setCaret(screen.getByRole('button', { name: /explore meanings/i }).firstChild as Text, 3))

    await waitFor(() => expect(screen.getByTestId('caret-index')).toHaveTextContent(String(originalCaret)))
    expect(screen.getByTestId('current-line')).toHaveTextContent('second line ends with dream')
  })
})
