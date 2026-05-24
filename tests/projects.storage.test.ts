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
import { buildDraftCollection } from '@/store/tabsStore'

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

  it('keeps active and last-open ids when trashing an inactive project', () => {
    const first = createProject('First')
    const second = createProject('Second')
    setLastOpenProjectId(second.id)

    moveProjectToTrash(first.id)

    expect(listTrashProjectSummaries().map((project) => project.id)).toEqual([first.id])
    expect(localStorage.getItem(LAST_OPEN_PROJECT_ID_KEY)).toBe(second.id)
  })

  it('repoints active and last-open ids when trashing the active project', () => {
    const first = createProject('First')
    const second = createProject('Second')
    setLastOpenProjectId(second.id)

    moveProjectToTrash(second.id)

    expect(listActiveProjectSummaries().map((project) => project.id)).toEqual([first.id])
    expect(localStorage.getItem(LAST_OPEN_PROJECT_ID_KEY)).toBe(first.id)
  })

  it('clears last-open id when trashing the only project', () => {
    const project = createProject('Only')
    setLastOpenProjectId(project.id)

    moveProjectToTrash(project.id)

    expect(listActiveProjectSummaries()).toEqual([])
    expect(localStorage.getItem(LAST_OPEN_PROJECT_ID_KEY)).toBeNull()
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


  it('counts lines in summaries correctly for empty, whitespace-only, and non-empty content', () => {
    const payload = {
      version: CURRENT_SCHEMA_VERSION,
      data: {
        drafts: [
          {
            docId: 'empty-content',
            title: 'Empty',
            createdAt: 1,
            updatedAt: 10,
            lines: [{ id: 'empty-line-0', text: '' }],
          },
          {
            docId: 'whitespace-content',
            title: 'Whitespace',
            createdAt: 2,
            updatedAt: 9,
            lines: [{ id: 'whitespace-line-0', text: ' \n \t ' }],
          },
          {
            docId: 'newline-content',
            title: 'Newline',
            createdAt: 3,
            updatedAt: 8,
            lines: [{ id: 'newline-line-0', text: '\n' }],
          },
          {
            docId: 'single-line-content',
            title: 'Single',
            createdAt: 4,
            updatedAt: 7,
            lines: [{ id: 'single-line-0', text: 'hello' }],
          },
          {
            docId: 'multi-line-content',
            title: 'Multi',
            createdAt: 5,
            updatedAt: 6,
            lines: [{ id: 'multi-line-0', text: 'hello\n\nworld' }],
          },
        ],
        activeId: 'empty-content',
      },
    }
    localStorage.setItem('rhyme-lines:persist:drafts', JSON.stringify(payload))

    const summariesById = new Map(listProjectSummaries().map((project) => [project.id, project]))

    expect(summariesById.get('empty-content')?.lineCount).toBe(0)
    expect(summariesById.get('whitespace-content')?.lineCount).toBe(0)
    expect(summariesById.get('newline-content')?.lineCount).toBe(0)
    expect(summariesById.get('single-line-content')?.lineCount).toBe(1)
    expect(summariesById.get('multi-line-content')?.lineCount).toBe(3)
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

  it('keeps archived project archived when draft save path builds from tabs with previous inferred from storage', () => {
    const project = createProject('Archived draft')
    archiveProject(project.id)
    const archivedBefore = listArchivedProjectSummaries()[0]
    expect(archivedBefore?.id).toBe(project.id)

    const draftCollection = buildDraftCollection(
      {
        activeTabId: project.id,
        tabs: [
          {
            id: project.id,
            title: 'Archived draft',
            snapshot: { text: 'Edited from editor path' },
            isDirty: true,
            createdAt: Date.parse(archivedBefore?.createdAt ?? new Date().toISOString()),
            updatedAt: Date.now(),
          },
        ],
      },
      null
    )

    const savedDraft = draftCollection.drafts.find((draft) => draft.docId === project.id)
    expect(savedDraft?.archived).toBe(true)
    expect(savedDraft?.archivedAt).toBe(archivedBefore?.archivedAt ?? null)
  })

  it('treats missing archived flag with archivedAt as archived', () => {
    const payload = {
      version: CURRENT_SCHEMA_VERSION,
      data: {
        drafts: [
          {
            docId: 'implicit-archived',
            title: 'Implicit archived',
            createdAt: 1,
            updatedAt: 2,
            archivedAt: '2025-01-01T00:00:00.000Z',
            lines: [{ id: 'legacy-line-0', text: 'line' }],
          },
        ],
        activeId: 'implicit-archived',
      },
    }
    localStorage.setItem('rhyme-lines:persist:drafts', JSON.stringify(payload))

    expect(listArchivedProjectSummaries().map((project) => project.id)).toEqual(['implicit-archived'])
    expect(listActiveProjectSummaries()).toEqual([])
  })
})
