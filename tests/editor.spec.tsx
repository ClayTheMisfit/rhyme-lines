import { act, fireEvent, render } from '@testing-library/react'
import Editor from '@/components/Editor'

describe('Editor line normalization', () => {
  test('ensures new blocks receive line class after Enter', () => {
    jest.useFakeTimers()

    const getSelectionMock = jest
      .spyOn(window, 'getSelection')
      .mockReturnValue({
        rangeCount: 0,
        removeAllRanges: () => {},
        addRange: () => {},
      } as unknown as Selection)

    type RangeWithClientRects = Range & { getClientRects: () => DOMRectList }
    const originalGetClientRects = (Range.prototype as RangeWithClientRects).getClientRects
    ;(Range.prototype as RangeWithClientRects).getClientRects = () => [] as unknown as DOMRectList

    const dispatchMock = jest.spyOn(window, 'dispatchEvent').mockImplementation(() => true)

    const { container, unmount } = render(<Editor />)

    try {
      const editor = container.querySelector('#lyric-editor') as HTMLDivElement
      expect(editor).toBeTruthy()

      editor.innerHTML = '<div class="line">First line</div>'
      const newBlock = document.createElement('div')
      newBlock.innerHTML = '<br>'
      editor.appendChild(newBlock)

      act(() => {
        const event = new window.Event('input', { bubbles: true })
        editor.dispatchEvent(event)
        jest.runOnlyPendingTimers()
      })

      const lines = Array.from(editor.children) as HTMLElement[]
      expect(lines).toHaveLength(2)
      expect(lines[1].tagName).toBe('DIV')
      expect(lines[1]).toHaveClass('line')
    } finally {
      unmount()
      ;(Range.prototype as RangeWithClientRects).getClientRects = originalGetClientRects
      dispatchMock.mockRestore()
      getSelectionMock.mockRestore()
      jest.runOnlyPendingTimers()
      jest.useRealTimers()
    }
  })


  test('clicking editor focuses editable surface before typing', () => {
    const { container, unmount } = render(<Editor />)

    try {
      const editor = container.querySelector('#lyric-editor') as HTMLDivElement
      expect(editor).toBeTruthy()

      fireEvent.pointerDown(editor)
      fireEvent.click(editor)

      expect(document.activeElement).toBe(editor)
    } finally {
      unmount()
    }
  })
  test('paste inserts plain text and syncs document without extra typing', () => {
    jest.useFakeTimers()

    const onTextChange = jest.fn()
    const dispatchMock = jest.spyOn(window, 'dispatchEvent').mockImplementation(() => true)

    const { container, unmount } = render(<Editor onTextChange={onTextChange} />)

    try {
      const editor = container.querySelector('#lyric-editor') as HTMLDivElement
      expect(editor).toBeTruthy()

      editor.focus()
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)

      act(() => {
        fireEvent.paste(editor, {
          clipboardData: {
            getData: (type: string) => (type === 'text/plain' ? 'alpha\r\nbeta\n\ngamma' : '<b>ignored</b>'),
          },
        })
        jest.runOnlyPendingTimers()
      })

      const lines = Array.from(editor.querySelectorAll('.line')) as HTMLDivElement[]
      expect(lines.length).toBeGreaterThanOrEqual(3)
      expect(onTextChange).toHaveBeenCalled()
      const lastText = onTextChange.mock.calls.at(-1)?.[0] ?? ''
      expect(lastText.replace(/\r\n?/g, '\n').trimEnd()).toBe('alpha\nbeta\n\ngamma')
      expect(editor.querySelector('span[style], font, strong, em')).toBeNull()
    } finally {
      unmount()
      dispatchMock.mockRestore()
      jest.runOnlyPendingTimers()
      jest.useRealTimers()
    }
  })
})
