import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import EditorLayout from '@/components/EditorLayout'

jest.mock('@/components/TopBar', () => function MockTopBar() {
  return <div data-testid="topbar">TopBar</div>
})
jest.mock('@/components/EditorShell', () => function MockEditorShell() {
  return <div data-testid="editor-shell">Editor</div>
})

const setActive = jest.fn()
const newTab = jest.fn()

const mockState = {
  tabs: [
    { id: 'a', title: 'Verse A', isDirty: false, updatedAt: 20 },
    { id: 'b', title: 'Verse B', isDirty: true, updatedAt: 10 },
  ],
  activeTabId: 'a',
  actions: {
    newTab,
    setActive,
  },
}

jest.mock('@/store/tabsStore', () => ({
  useTabsStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}))

describe('EditorLayout sidebar toggle', () => {
  beforeEach(() => {
    localStorage.clear()
    setActive.mockReset()
    newTab.mockReset()
  })

  test('renders expanded sidebar by default with collapse toggle', () => {
    const { container } = render(<EditorLayout />)

    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verse A' })).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('bg-[color:var(--rl-shell-bg)]')
    expect(container.firstChild).toHaveClass('h-dvh')
    expect(container.firstChild).toHaveClass('overflow-hidden')
  })

  test('collapses and expands via toggle click', async () => {
    render(<EditorLayout />)

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false')
    })
    expect(screen.queryByText('Documents')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toHaveAttribute('aria-expanded', 'true')
  })

  test('persists collapsed state and hydrates from storage', async () => {
    localStorage.setItem('rhyme-lines:editor-sidebar-collapsed', 'true')

    render(<EditorLayout />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false')
    })
  })

  test('supports Ctrl/Cmd + Backquote shortcut', async () => {
    render(<EditorLayout />)

    fireEvent.keyDown(window, { code: 'Backquote', key: '`', ctrlKey: true })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false')
    })
  })
})
