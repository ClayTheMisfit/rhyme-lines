import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import Editor, { type EditorHandle } from './Editor'
import { getEditorPlainTextIndexFromSelection } from '@/lib/editor/plainText'

function setCaret(textNode: Text, offset: number) {
  const range = document.createRange()
  range.setStart(textNode, offset)
  range.collapse(true)
  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
}

function caretOffset() {
  const selection = document.getSelection()
  return selection?.focusOffset ?? -1
}

describe('Editor imperative API', () => {
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

  it('restores the saved editor caret after an external control takes focus', async () => {
    const editorRef = createRef<EditorHandle>()
    render(<><Editor ref={editorRef} text={'first word\nsecond line ends with dream\nthird line'} /><button>Explore Meanings</button></>)
    const editor = await screen.findByRole('textbox', { name: /lyric editor/i })
    await waitFor(() => expect(editor.querySelectorAll('.line')).toHaveLength(3))
    const secondLineText = editor.querySelectorAll('.line')[1].firstChild as Text

    act(() => setCaret(secondLineText, 'second line ends with dream'.length))
    act(() => { (screen.getByRole('button', { name: /explore meanings/i }) as HTMLButtonElement).focus() })
    act(() => editorRef.current?.focus())

    expect(document.activeElement).toBe(editor)
    expect(document.getSelection()?.focusNode).toBe(secondLineText)
    expect(caretOffset()).toBe('second line ends with dream'.length)
  })

  it('inserts text at the saved editor caret and reports the updated document', async () => {
    const editorRef = createRef<EditorHandle>()
    const onTextChange = jest.fn()
    render(<><Editor ref={editorRef} text={'first word on line one\nsecond line ends with dream\nthird line stays here'} onTextChange={onTextChange} /><button>Panel control</button></>)
    const editor = await screen.findByRole('textbox', { name: /lyric editor/i })
    await waitFor(() => expect(editor.querySelectorAll('.line')).toHaveLength(3))
    const secondLineText = editor.querySelectorAll('.line')[1].firstChild as Text
    const savedOffset = 'second line ends with dream'.length

    act(() => setCaret(secondLineText, savedOffset))
    act(() => { (screen.getByRole('button', { name: /panel control/i }) as HTMLButtonElement).focus() })
    let inserted = false
    act(() => { inserted = editorRef.current?.insertText(' decision') ?? false })

    expect(inserted).toBe(true)
    expect(editor.textContent).toContain('first word on line one')
    expect(editor.textContent).toContain('second line ends with dream decision')
    expect(editor.textContent?.startsWith(' decision')).toBe(false)
    expect(document.getSelection()?.isCollapsed).toBe(true)
    expect(getEditorPlainTextIndexFromSelection(editor, document.getSelection())?.index).toBe(59)
    expect(onTextChange).toHaveBeenLastCalledWith(expect.stringContaining('first word on line one\nsecond line ends with dream decision\nthird line stays here'))
  })

  it('replaces a validated rhyme target through the normal editor change path', async () => {
    const editorRef = createRef<EditorHandle>()
    const onTextChange = jest.fn()
    const text = 'Midnight in my Brain,'
    render(<Editor ref={editorRef} text={text} onTextChange={onTextChange} />)
    const editor = await screen.findByRole('textbox', { name: /lyric editor/i })
    await waitFor(() => expect(editor.textContent).toContain(text))

    let replaced = false
    act(() => {
      replaced = editorRef.current?.replaceRhymeTarget('pain', {
        start: text.indexOf('Brain'),
        end: text.indexOf('Brain') + 5,
        normalizedWord: 'brain',
      }) ?? false
    })

    expect(replaced).toBe(true)
    expect(editor.textContent).toContain('Midnight in my Pain,')
    expect(onTextChange).toHaveBeenLastCalledWith(expect.stringContaining('Midnight in my Pain,'))
    expect(document.activeElement).toBe(editor)
  })
})
