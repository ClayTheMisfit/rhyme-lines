import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EditorShell from '@/components/EditorShell'
import { useRhymePanel } from '@/lib/state/rhymePanel'

const resetPanelState = () => {
  useRhymePanel.setState((state) => ({
    ...state,
    mode: 'hidden',
    filter: 0,
    x: 96,
    y: 96,
    width: 360,
    height: 560,
  }))
}

describe('Rhyme panel interactions', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    consoleErrorSpy.mockRestore()
  })

  beforeEach(() => {
    localStorage.clear()
    resetPanelState()
  })

  const renderWithQueryClient = async () => {
    const queryClient = new QueryClient()
    let utils: ReturnType<typeof render> | undefined

    await act(async () => {
      utils = render(
        <QueryClientProvider client={queryClient}>
          <EditorShell />
        </QueryClientProvider>
      )
    })

    return utils as ReturnType<typeof render>
  }

  test('Alt+R opens and focuses the rhyme panel', async () => {
    await renderWithQueryClient()

    expect(screen.queryByTestId('rhyme-panel-root')).not.toBeInTheDocument()

    act(() => {
      fireEvent.keyDown(window, { altKey: true, key: 'r' })
    })

    const panel = await screen.findByTestId('rhyme-panel-root')

    await waitFor(() => {
      expect(panel).toHaveFocus()
    })

    expect(useRhymePanel.getState().mode).toBe('docked')
  })

  test('Alt+R refocuses an already open panel', async () => {
    useRhymePanel.setState((state) => ({ ...state, mode: 'docked' }))
    await renderWithQueryClient()

    const editor = document.getElementById('lyric-editor') as HTMLElement
    expect(editor).toBeInTheDocument()
    editor.focus()

    act(() => {
      fireEvent.keyDown(window, { altKey: true, key: 'r' })
    })

    const panel = await screen.findByTestId('rhyme-panel-root')
    await waitFor(() => {
      expect(panel).toHaveFocus()
    })

    expect(useRhymePanel.getState().mode).toBe('docked')
  })

  test('Escape closes the panel and refocuses the editor', async () => {
    useRhymePanel.setState((state) => ({ ...state, mode: 'docked' }))
    await renderWithQueryClient()

    const panel = await screen.findByTestId('rhyme-panel-root')
    panel.focus()

    act(() => {
      fireEvent.keyDown(panel, { key: 'Escape' })
    })

    await waitFor(() => {
      expect(screen.queryByTestId('rhyme-panel-root')).not.toBeInTheDocument()
    })

    const editor = document.getElementById('lyric-editor') as HTMLElement
    await waitFor(() => {
      expect(editor).toHaveFocus()
    })

    expect(useRhymePanel.getState().mode).toBe('hidden')
  })

  test('Drag handle is visible in detached mode', async () => {
    useRhymePanel.setState((state) => ({ ...state, mode: 'detached' }))
    await renderWithQueryClient()

    await screen.findByTestId('rhyme-panel-root')
    const dragHandle = document.querySelector('.rhyme-panel-drag-handle')
    expect(dragHandle).toBeInTheDocument()
  })
})
