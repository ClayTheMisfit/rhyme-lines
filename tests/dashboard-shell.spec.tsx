import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import * as storage from '@/lib/projects/storage'
import type { ProjectFolder, ProjectSummary } from '@/lib/projects/storage'

const pushMock = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

jest.mock('next/link', () => {
  return function MockLink({ href, onClick, children, ...rest }: any) {
    return (
      <a
        {...rest}
        href={typeof href === 'string' ? href : '#'}
        onClick={(event) => {
          event.preventDefault()
          onClick?.(event)
        }}
      >
        {children}
      </a>
    )
  }
})

jest.mock('@/lib/projects/storage', () => ({
  archiveProject: jest.fn(),
  assignProjectFolder: jest.fn(),
  createFolder: jest.fn(),
  createProject: jest.fn(),
  filterProjectSummaries: jest.fn(),
  getProjectCounts: jest.fn(),
  getLastOpenProjectId: jest.fn(),
  listActiveProjectSummaries: jest.fn(),
  listArchivedProjectSummaries: jest.fn(),
  listFolders: jest.fn(),
  listTrashProjectSummaries: jest.fn(),
  moveProjectToTrash: jest.fn(),
  permanentlyDeleteProject: jest.fn(),
  renameProject: jest.fn(),
  restoreProject: jest.fn(),
  restoreProjectFromTrash: jest.fn(),
  setLastOpenProjectId: jest.fn(),
}))

const storageMocks = jest.mocked(storage)

const buildProject = (
  id: string,
  title: string,
  updatedAt: string,
  options?: { archived?: boolean; deletedAt?: string | null; folderId?: string | null }
): ProjectSummary => ({
  id,
  title,
  preview: `${title} preview`,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
  archived: options?.archived ?? false,
  archivedAt: options?.archived ? updatedAt : null,
  deletedAt: options?.deletedAt ?? null,
  folderId: options?.folderId ?? null,
  folderName: null,
  wordCount: 12,
  lineCount: 4,
  rhymeDensity: 0.5,
  internalRhymes: 2,
  endRhymeFamilyCount: 2,
  averageSyllablesPerLine: 6,
})

describe('DashboardShell', () => {
  const folderA: ProjectFolder = {
    id: 'folder-a',
    name: 'Hooks',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
  const folderB: ProjectFolder = {
    id: 'folder-b',
    name: 'Verses',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  const newest = buildProject('project-new', 'Newest Draft', '2026-04-21T00:00:00.000Z', {
    folderId: folderA.id,
  })
  const older = buildProject('project-old', 'Older Draft', '2026-04-20T00:00:00.000Z')
  const archived = buildProject('project-archived', 'Archived Draft', '2026-04-18T00:00:00.000Z', {
    archived: true,
    folderId: folderB.id,
  })
  const trashed = buildProject('project-trash', 'Trashed Draft', '2026-04-17T00:00:00.000Z', {
    deletedAt: '2026-04-21T00:00:00.000Z',
    folderId: folderB.id,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    storageMocks.listActiveProjectSummaries.mockReturnValue([newest, older])
    storageMocks.listArchivedProjectSummaries.mockReturnValue([archived])
    storageMocks.listTrashProjectSummaries.mockReturnValue([trashed])
    storageMocks.listFolders.mockReturnValue([folderA, folderB])
    storageMocks.getProjectCounts.mockReturnValue({ archived: 1, trash: 0 })
    storageMocks.filterProjectSummaries.mockImplementation((projects) => projects)
    storageMocks.getLastOpenProjectId.mockReturnValue('project-old')
    storageMocks.createProject.mockReturnValue({ id: 'created-id' } as never)
  })

  it('prefers last-open project in resume block and keeps organize controls collapsed by default', async () => {
    render(<DashboardShell />)

    expect(await screen.findByText('RESUME LAST PROJECT')).toBeInTheDocument()
    const resumeButton = screen.getByRole('button', { name: 'RESUME WRITING' })
    expect(resumeButton.closest('div')).toHaveTextContent('Older Draft')

    const organizeButton = screen.getByRole('button', { name: 'ORGANIZE PROJECTS' })
    expect(organizeButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByPlaceholderText('New folder')).not.toBeInTheDocument()
  })

  it('updates last-open metadata for resume block and project-row open paths', async () => {
    render(<DashboardShell />)

    fireEvent.click(await screen.findByRole('button', { name: 'RESUME WRITING' }))
    expect(storageMocks.setLastOpenProjectId).toHaveBeenCalledWith('project-old')
    expect(pushMock).toHaveBeenCalledWith('/editor/project-old')

    fireEvent.click(screen.getByRole('link', { name: 'Open Newest Draft' }))
    expect(storageMocks.setLastOpenProjectId).toHaveBeenCalledWith('project-new')
  })

  it('keeps New Project and Resume Writing keyboard focusable', async () => {
    render(<DashboardShell />)

    const newProject = await screen.findByRole('button', { name: 'NEW PROJECT' })
    const resumeWriting = screen.getByRole('button', { name: 'RESUME WRITING' })

    newProject.focus()
    expect(newProject).toHaveFocus()

    resumeWriting.focus()
    expect(resumeWriting).toHaveFocus()
  })

  it('keeps projects/archived view toggles working', async () => {
    const user = userEvent.setup()
    render(<DashboardShell />)

    expect(await screen.findByText('Recent Drafts')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Archived/i }))
    await waitFor(() => expect(screen.getByText('Archived Projects')).toBeInTheDocument())
    expect(screen.getByText('Archived Draft')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Projects/i }))
    await waitFor(() => expect(screen.getByText('Recent Drafts')).toBeInTheDocument())
    expect(screen.getByText('Newest Draft')).toBeInTheDocument()
  })

  it('does not apply hidden folder filtering in archived/trash views', async () => {
    const user = userEvent.setup()
    storageMocks.filterProjectSummaries.mockImplementation((projects, search, folderId) => {
      const normalizedSearch = search.trim().toLowerCase()
      return projects.filter((project) => {
        const matchesFolder =
          folderId === null ? true : folderId === '__none__' ? !project.folderId : project.folderId === folderId
        if (!matchesFolder) return false
        if (!normalizedSearch) return true
        return project.title.toLowerCase().includes(normalizedSearch)
      })
    })

    render(<DashboardShell />)

    await user.click(screen.getByRole('button', { name: 'ORGANIZE PROJECTS' }))
    await user.selectOptions(screen.getByLabelText('Folder'), folderA.id)

    await waitFor(() => expect(screen.getByRole('link', { name: 'Open Newest Draft' })).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Open Older Draft' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Archived/i }))
    await waitFor(() => expect(screen.getByText('Archived Projects')).toBeInTheDocument())
    expect(screen.getByText('Archived Draft')).toBeInTheDocument()
    expect(storageMocks.filterProjectSummaries).toHaveBeenLastCalledWith(expect.any(Array), '', null, [folderA, folderB])

    await user.click(screen.getByRole('button', { name: /Trash/i }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trash' })).toBeInTheDocument())
    expect(screen.getByText('Trashed Draft')).toBeInTheDocument()
    expect(storageMocks.filterProjectSummaries).toHaveBeenLastCalledWith(expect.any(Array), '', null, [folderA, folderB])

    await user.click(screen.getByRole('button', { name: /Projects/i }))
    await waitFor(() => expect(screen.getByText('Recent Drafts')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Open Newest Draft' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open Older Draft' })).not.toBeInTheDocument()
    expect(storageMocks.filterProjectSummaries).toHaveBeenLastCalledWith(
      expect.any(Array),
      '',
      folderA.id,
      [folderA, folderB]
    )
  })
})
