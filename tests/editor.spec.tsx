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

    const originalGetClientRects = (Range.prototype as any).getClientRects
    ;(Range.prototype as any).getClientRects = () => []

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
      ;(Range.prototype as any).getClientRects = originalGetClientRects
      dispatchMock.mockRestore()
      getSelectionMock.mockRestore()
      jest.runOnlyPendingTimers()
      jest.useRealTimers()
    }
  })
})
