import { CURRENT_SCHEMA_VERSION } from '@/lib/persist/schema'
import {
  LAST_OPEN_PROJECT_ID_KEY,
  archiveProject,
  assignProjectFolder,
  createFolder,
  createProject,
  deleteProject,
  filterProjectSummaries,
  getProjectCounts,
  listActiveProjectSummaries,
  listArchivedProjectSummaries,
  listFolders,
  listProjectSummaries,
  listTrashProjectSummaries,
  moveProjectToTrash,
  permanentlyDeleteProject,
  renameProject,
  restoreProject,
  restoreProjectFromTrash,
  setLastOpenProjectId,
} from '@/lib/projects/storage'

describe('project storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty project list for a pristine placeholder draft', () => {
    const payload = {
      version: CURRENT_SCHEMA_VERSION,
      data: {
        drafts: [
          {
            docId: 'placeholder',
            title: 'Untitled',
            createdAt: 1,
            updatedAt: 1,
            lines: [{ id: 'placeholder-line-0', text: '' }],
          },
        ],
        activeId: 'placeholder',
      },
    }
    localStorage.setItem('rhyme-lines:persist:drafts', JSON.stringify(payload))

    expect(listProjectSummaries()).toEqual([])
  })

  it('creates projects and sorts summaries by updatedAt descending', () => {
    jest.useFakeTimers()
    const baseTime = new Date('2024-01-01T00:00:00.000Z').getTime()
    jest.setSystemTime(baseTime)

    const first = createProject('First')
    jest.advanceTimersByTime(1)
    const second = createProject('Second')

    jest.useRealTimers()

    const projects = listProjectSummaries()
    expect(projects.map((project) => project.id)).toEqual([second.id, first.id])
    expect(localStorage.getItem(LAST_OPEN_PROJECT_ID_KEY)).toBe(second.id)
  })

  it('renames a project and falls back to Untitled Project for blank input', () => {
    const project = createProject('Initial')

    renameProject(project.id, '  Better title  ')
    expect(listProjectSummaries()[0]?.title).toBe('Better title')

    renameProject(project.id, '   ')
    expect(listProjectSummaries()[0]?.title).toBe('Untitled Project')
  })

  it('archives and restores a project', () => {
    const project = createProject('Archive me')
    archiveProject(project.id)

    const archived = listArchivedProjectSummaries()
    expect(archived).toHaveLength(1)
    expect(archived[0]?.id).toBe(project.id)
    expect(archived[0]?.archived).toBe(true)
    expect(typeof archived[0]?.archivedAt).toBe('string')

    restoreProject(project.id)

    expect(listArchivedProjectSummaries()).toEqual([])
    const active = listActiveProjectSummaries()
    expect(active).toHaveLength(1)
    expect(active[0]?.id).toBe(project.id)
    expect(active[0]?.archived).toBe(false)
    expect(active[0]?.archivedAt).toBeNull()
  })

  it('moves projects to trash and supports restore/permanent delete', () => {
    const project = createProject('Trash me')

    moveProjectToTrash(project.id)
    expect(listTrashProjectSummaries()).toHaveLength(1)
    expect(listActiveProjectSummaries()).toEqual([])

    restoreProjectFromTrash(project.id)
    expect(listTrashProjectSummaries()).toEqual([])
    expect(listActiveProjectSummaries()).toHaveLength(1)

    moveProjectToTrash(project.id)
    permanentlyDeleteProject(project.id)
    expect(listTrashProjectSummaries()).toEqual([])
    expect(listProjectSummaries()).toEqual([])
  })

  it('creates folders and assigns projects to folders', () => {
    const project = createProject('Folder project')
    const folder = createFolder(' Hooks ')

    expect(folder?.name).toBe('Hooks')
    expect(listFolders().map((item) => item.name)).toEqual(['Hooks'])

    assignProjectFolder(project.id, folder?.id ?? null)
    expect(listProjectSummaries()[0]?.folderId).toBe(folder?.id)
    expect(listProjectSummaries()[0]?.folderName).toBe('Hooks')
  })

  it('filters projects by search and folder', () => {
    const alpha = createProject('Alpha song')
    const beta = createProject('Beta draft')
    const folder = createFolder('Practice')
    assignProjectFolder(alpha.id, folder?.id ?? null)

    const projects = listActiveProjectSummaries()
    const folders = listFolders()

    expect(filterProjectSummaries(projects, 'alpha', null, folders).map((project) => project.id)).toContain(alpha.id)
    expect(filterProjectSummaries(projects, 'practice', null, folders).map((project) => project.id)).toContain(alpha.id)
    expect(filterProjectSummaries(projects, '', folder?.id ?? null, folders).map((project) => project.id)).toEqual([alpha.id])
    expect(filterProjectSummaries(projects, '', '__none__', folders).map((project) => project.id)).toEqual([beta.id])
  })

  it('reports archived and trash counts excluding trashed archived projects', () => {
    const one = createProject('One')
    const two = createProject('Two')
    archiveProject(one.id)
    archiveProject(two.id)
    moveProjectToTrash(two.id)

    expect(getProjectCounts()).toEqual({ archived: 1, trash: 1 })
  })

  it('migrates text from legacy autosave key when no structured drafts exist', () => {
    localStorage.setItem('autosave', 'legacy line one\nlegacy line two')

    const projects = listProjectSummaries()
    expect(projects).toHaveLength(1)
    expect(projects[0]?.lineCount).toBe(2)
    expect(projects[0]?.wordCount).toBe(6)
  })

  it('deletes a project and clears last-open id when it was selected', () => {
    const project = createProject('Delete me')
    setLastOpenProjectId(project.id)

    deleteProject(project.id)

    expect(listProjectSummaries()).toEqual([])
    expect(localStorage.getItem(LAST_OPEN_PROJECT_ID_KEY)).toBeNull()
  })

  it('treats legacy drafts missing archive and folder fields as active', () => {
    const payload = {
      version: CURRENT_SCHEMA_VERSION,
      data: {
        drafts: [
          {
            docId: 'legacy-project',
            title: 'Legacy',
            createdAt: 1,
            updatedAt: 2,
            lines: [{ id: 'legacy-line-0', text: 'hello legacy world' }],
          },
        ],
        activeId: 'legacy-project',
      },
    }
    localStorage.setItem('rhyme-lines:persist:drafts', JSON.stringify(payload))

    const all = listProjectSummaries()
    expect(all).toHaveLength(1)
    expect(all[0]?.archived).toBe(false)
    expect(all[0]?.archivedAt).toBeNull()
    expect(all[0]?.deletedAt).toBeNull()
    expect(all[0]?.folderId).toBeNull()
    expect(listActiveProjectSummaries()).toHaveLength(1)
    expect(listArchivedProjectSummaries()).toEqual([])
  })
})
