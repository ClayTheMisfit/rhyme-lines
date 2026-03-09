import { act, render } from '@testing-library/react'
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

    const rangeProto = Range.prototype as Range & { getClientRects: () => DOMRectList }
    const originalGetClientRects = rangeProto.getClientRects
    rangeProto.getClientRects = () => [] as unknown as DOMRectList

    const dispatchMock = jest
      .spyOn(window, 'dispatchEvent')
      .mockImplementation(() => true)

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
      rangeProto.getClientRects = originalGetClientRects
      dispatchMock.mockRestore()
      getSelectionMock.mockRestore()
      jest.runOnlyPendingTimers()
      jest.useRealTimers()
    }
  })

  test('drop inserts text/plain only', () => {
    const originalExecCommand = (document as Document & { execCommand?: typeof document.execCommand }).execCommand
    const execCommandMock = jest.fn((commandId: string, showUI?: boolean, value?: string) => {
      void commandId
      void showUI
      void value
      return true
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommandMock,
    })

    const { container, unmount } = render(<Editor />)

    try {
      const editor = container.querySelector('#lyric-editor') as HTMLDivElement
      expect(editor).toBeTruthy()

      const preventDefault = jest.fn()
      const getData = jest.fn((type: string) => {
        if (type === 'text/plain') return 'hello\nworld'
        if (type === 'text/html') return '<img src=x onerror=alert(1)>'
        return ''
      })

      act(() => {
        const event = new window.Event('drop', { bubbles: true, cancelable: true }) as Event & {
          dataTransfer: { getData: (type: string) => string }
          preventDefault: () => void
        }
        Object.defineProperty(event, 'dataTransfer', {
          value: { getData },
          configurable: true,
        })
        event.preventDefault = preventDefault
        editor.dispatchEvent(event)
      })

      expect(preventDefault).toHaveBeenCalled()
      expect(getData).toHaveBeenCalledWith('text/plain')
      expect(execCommandMock).toHaveBeenCalledWith('insertText', false, 'hello\nworld')
    } finally {
      if (originalExecCommand) {
        Object.defineProperty(document, 'execCommand', {
          configurable: true,
          value: originalExecCommand,
        })
      }
      unmount()
    }
  })
})
