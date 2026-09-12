import { render, screen, waitFor } from '@testing-library/react'
import EditorLayout from '@/components/EditorLayout'
import { EditorRouteRedirect } from '@/components/editor/EditorRouteRedirect'
import {
  isDraftPersistenceAllowed,
  resetDraftPersistenceForTests,
} from '@/lib/persist/draftCoordinator'
import { setLastOpenProjectId } from '@/lib/projects/storage'
import {
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEYS,
  createDefaultDraftCollection,
  type DraftCollection,
} from '@/lib/persist/schema'
import { hydrateTabsFromPersisted, useTabsStore } from '@/store/tabsStore'

const replace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock('@/components/TopBar', () => function MockTopBar() {
  return <div>TopBar</div>
})

jest.mock('@/components/EditorShell', () => function MockEditorShell() {
  const activeTab = useTabsStore((state) =>
    state.tabs.find((tab) => tab.id === state.activeTabId)
  )
  return <div data-testid="editor-shell">{activeTab?.snapshot.text}</div>
})

const persistedCollection = (): DraftCollection => ({
  drafts: [
    {
      docId: 'project-a',
      title: 'Project A',
      createdAt: 1,
      updatedAt: 2,
      lines: [{ id: 'project-a-line-0', text: 'Project A content' }],
    },
    {
      docId: 'project-b',
      title: 'COLD DEEP LINK TARGET',
      createdAt: 3,
      updatedAt: 4,
      lines: [{ id: 'project-b-line-0', text: 'THIS PROJECT MUST OPEN AFTER HYDRATION' }],
    },
  ],
  activeId: 'project-a',
  folders: [],
})

describe('editor route hydration ordering', () => {
  beforeEach(() => {
    localStorage.clear()
    replace.mockReset()
    resetDraftPersistenceForTests()
    hydrateTabsFromPersisted(createDefaultDraftCollection(), { allowPersistence: false })
    localStorage.setItem(
      STORAGE_KEYS.drafts,
      JSON.stringify({ version: CURRENT_SCHEMA_VERSION, data: persistedCollection() })
    )
  })

  afterEach(() => {
    resetDraftPersistenceForTests()
    localStorage.clear()
  })

  it('opens a persisted cold deep-link target before deciding that the route is missing', async () => {
    render(<EditorLayout projectId="project-b" />)

    await waitFor(() => {
      expect(screen.getByTestId('editor-shell')).toHaveTextContent(
        'THIS PROJECT MUST OPEN AFTER HYDRATION'
      )
    })
    expect(replace).not.toHaveBeenCalledWith(expect.stringMatching(/^\/editor\/(?!project-b)/))
  })

  it('waits for hydration before applying the existing missing-project fallback', async () => {
    render(<EditorLayout projectId="missing-project" />)

    expect(replace).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/editor/project-a')
    })
  })

  it('resolves the editor landing route from hydrated last-open metadata', async () => {
    setLastOpenProjectId('project-b')

    render(<EditorRouteRedirect />)

    expect(replace).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/editor/project-b')
    })
  })

  it('keeps the requested route unchanged during the pending render', () => {
    render(<EditorLayout projectId="project-b" />)

    expect(replace).not.toHaveBeenCalled()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  })

  it('keeps an invalid hydration payload blocked without declaring the route missing', async () => {
    localStorage.setItem(STORAGE_KEYS.drafts, '7')

    render(<EditorLayout projectId="project-b" />)

    expect(await screen.findByRole('status')).toHaveTextContent('Drafts could not be loaded')
    expect(replace).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEYS.drafts)).toBe('7')
    expect(isDraftPersistenceAllowed()).toBe(false)
  })

  it('reopens the persisted project after a route reload', async () => {
    const firstLoad = render(<EditorLayout projectId="project-b" />)
    expect(await screen.findByTestId('editor-shell')).toHaveTextContent(
      'THIS PROJECT MUST OPEN AFTER HYDRATION'
    )
    firstLoad.unmount()

    resetDraftPersistenceForTests()
    hydrateTabsFromPersisted(createDefaultDraftCollection(), { allowPersistence: false })
    replace.mockReset()
    render(<EditorLayout projectId="project-b" />)

    expect(await screen.findByTestId('editor-shell')).toHaveTextContent(
      'THIS PROJECT MUST OPEN AFTER HYDRATION'
    )
    expect(replace).not.toHaveBeenCalledWith(expect.stringMatching(/^\/editor\/(?!project-b)/))
  })

  it('redirects the editor landing route to the dashboard for a hydrated empty collection', async () => {
    localStorage.setItem(
      STORAGE_KEYS.drafts,
      JSON.stringify({
        version: CURRENT_SCHEMA_VERSION,
        data: { drafts: [], activeId: null, folders: [] },
      })
    )

    render(<EditorRouteRedirect />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(useTabsStore.getState().tabs).toEqual([])
    expect(useTabsStore.getState().activeTabId).toBeNull()
  })

  it('redirects a missing project route directly to the dashboard when no live drafts exist', async () => {
    localStorage.setItem(
      STORAGE_KEYS.drafts,
      JSON.stringify({
        version: CURRENT_SCHEMA_VERSION,
        data: { drafts: [], activeId: null, folders: [] },
      })
    )

    render(<EditorLayout projectId="deleted-project" />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(screen.queryByTestId('editor-shell')).not.toBeInTheDocument()
  })
})
