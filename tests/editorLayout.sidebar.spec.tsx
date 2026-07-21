import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import EditorLayout from '@/components/EditorLayout'
import { setLastOpenProjectId } from '@/lib/projects/storage'

jest.mock('@/components/TopBar', () => function MockTopBar() {
  return <div data-testid="topbar">TopBar</div>
})
jest.mock('@/components/EditorShell', () => function MockEditorShell() {
  return <div data-testid="editor-shell">Editor</div>
})

const setActive = jest.fn()
const newTab = jest.fn()
const replace = jest.fn()
const push = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push, prefetch: jest.fn() }),
}))

const mockState = {
  tabs: [
    { id: 'a', title: 'Verse A', isDirty: false, createdAt: 20, updatedAt: 20, isPinned: false, position: 1000 },
    { id: 'b', title: 'Verse B', isDirty: true, createdAt: 10, updatedAt: 10, isPinned: false, position: 2000 },
  ],
  activeTabId: 'a',
  actions: {
    newTab,
    setActive,
    renameTab: jest.fn(),
    pinTab: jest.fn(),
    unpinTab: jest.fn(),
    moveTab: jest.fn(),
    moveTabToIndex: jest.fn(),
    deleteTab: jest.fn(),
  },
}

jest.mock('@/store/tabsStore', () => ({
  MAX_TAB_TITLE_LENGTH: 100,
  getOrderedTabs: (tabs: typeof mockState.tabs) => [...tabs].sort((a, b) => a.position - b.position),
  useTabsStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}))

describe('EditorLayout sidebar toggle', () => {
  beforeEach(() => {
    localStorage.clear()
    setActive.mockReset()
    newTab.mockReset()
    replace.mockReset()
    push.mockReset()
  })

  test('renders expanded sidebar by default with collapse toggle', () => {
    const { container } = render(<EditorLayout />)

    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verse A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actions for Verse A' })).toBeInTheDocument()
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

  test('redirects invalid project route and does not render editor shell while correcting', async () => {
    setLastOpenProjectId('missing')
    render(<EditorLayout projectId="missing" />)
    expect(screen.queryByTestId('editor-shell')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/editor/a')
    })
  })

  test('syncs active tab state to route project id without bouncing URL', async () => {
    render(<EditorLayout projectId="b" />)
    await waitFor(() => {
      expect(setActive).toHaveBeenCalledWith('b')
    })
    expect(replace).not.toHaveBeenCalledWith('/editor/a')
  })
})

describe('EditorLayout document row management controls', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.values(mockState.actions).forEach((action) => {
      if (typeof action === 'function' && 'mockReset' in action) action.mockReset()
    })
    replace.mockReset()
  })

  test('opens the overflow menu and exposes document actions', () => {
    render(<EditorLayout />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Verse A' }))
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Pin' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Move down' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
  })

  test('starts and completes inline rename from the menu', () => {
    render(<EditorLayout />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Verse A' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const input = screen.getByRole('textbox', { name: 'Rename Verse A' })
    fireEvent.change(input, { target: { value: '  New Verse  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockState.actions.renameTab).toHaveBeenCalledWith('a', '  New Verse  ')
  })

  test('cancels inline rename with Escape and supports F2 shortcut', () => {
    render(<EditorLayout />)
    fireEvent.keyDown(screen.getByRole('listitem', { name: /Verse A/ }), { key: 'F2' })
    const input = screen.getByRole('textbox', { name: 'Rename Verse A' })
    fireEvent.change(input, { target: { value: 'Discard me' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(mockState.actions.renameTab).not.toHaveBeenCalled()
  })

  test('supports pin, keyboard move, and delete confirmation actions', () => {
    render(<EditorLayout />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Verse A' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pin' }))
    expect(mockState.actions.pinTab).toHaveBeenCalledWith('a')

    fireEvent.keyDown(screen.getByRole('listitem', { name: /Verse B/ }), { key: 'ArrowUp', altKey: true })
    expect(mockState.actions.moveTab).toHaveBeenCalledWith('b', -1)

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Verse A' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete Verse A' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockState.actions.deleteTab).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Verse A' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(mockState.actions.deleteTab).toHaveBeenCalledWith('a')
  })
})
