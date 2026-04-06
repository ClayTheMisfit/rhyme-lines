import { CURRENT_SCHEMA_VERSION } from '@/lib/persist/schema'
import {
  LAST_OPEN_PROJECT_ID_KEY,
  PROJECT_META_KEY,
  archiveProject,
  createProject,
  deleteProject,
  listProjectSummaries,
  restoreProject,
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

    expect(listProjectSummaries('active')).toEqual([])
  })

  it('creates projects and sorts active summaries by updatedAt descending', () => {
    const first = createProject('First')
    const second = createProject('Second')

    const projects = listProjectSummaries('active')
    expect(projects.map((project) => project.id)).toEqual([second.id, first.id])
    expect(localStorage.getItem(LAST_OPEN_PROJECT_ID_KEY)).toBe(second.id)
  })

  it('migrates text from legacy autosave key when no structured drafts exist', () => {
    localStorage.setItem('autosave', 'legacy line one\nlegacy line two')

    const projects = listProjectSummaries('active')
    expect(projects).toHaveLength(1)
    expect(projects[0]?.lineCount).toBe(2)
    expect(projects[0]?.wordCount).toBe(6)
    expect(projects[0]?.archived).toBe(false)
    expect(projects[0]?.archivedAt).toBeNull()
  })

  it('archives and restores projects with archived view sorting', () => {
    const one = createProject('One')
    const two = createProject('Two')

    archiveProject(one.id)
    archiveProject(two.id)

    localStorage.setItem(
      PROJECT_META_KEY,
      JSON.stringify({
        [one.id]: { archived: true, archivedAt: '2026-01-01T00:00:00.000Z' },
        [two.id]: { archived: true, archivedAt: '2026-02-01T00:00:00.000Z' },
      })
    )

    const archived = listProjectSummaries('archived')
    expect(archived).toHaveLength(2)
    expect(archived[0]?.id).toBe(two.id)
    expect(archived[1]?.id).toBe(one.id)
    expect(archived.every((project) => project.archived)).toBe(true)

    restoreProject(two.id)

    const active = listProjectSummaries('active')
    const archivedAfterRestore = listProjectSummaries('archived')
    expect(active.some((project) => project.id === two.id)).toBe(true)
    expect(archivedAfterRestore.some((project) => project.id === two.id)).toBe(false)
  })

  it('treats legacy projects without metadata as unarchived', () => {
    const project = createProject('Legacy-safe')
    localStorage.removeItem(PROJECT_META_KEY)

    const projects = listProjectSummaries('active')
    expect(projects.some((entry) => entry.id === project.id)).toBe(true)
    expect(projects.find((entry) => entry.id === project.id)?.archived).toBe(false)
  })

  it('deletes a project and clears last-open id when it was selected', () => {
    const project = createProject('Delete me')
    setLastOpenProjectId(project.id)

    deleteProject(project.id)

    expect(listProjectSummaries('active')).toEqual([])
    expect(localStorage.getItem(LAST_OPEN_PROJECT_ID_KEY)).toBeNull()
  })
})
