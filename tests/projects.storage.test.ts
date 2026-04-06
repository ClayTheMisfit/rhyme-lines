import { CURRENT_SCHEMA_VERSION } from '@/lib/persist/schema'
import {
  LAST_OPEN_PROJECT_ID_KEY,
  createProject,
  deleteProject,
  listProjectSummaries,
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
    // Use fake timers to ensure deterministic timestamps
    jest.useFakeTimers()
    const baseTime = new Date('2024-01-01T00:00:00.000Z').getTime()
    jest.setSystemTime(baseTime)

    const first = createProject('First')

    // Advance time by 1ms to ensure distinct timestamps
    jest.advanceTimersByTime(1)

    const second = createProject('Second')

    jest.useRealTimers()

    const projects = listProjectSummaries()
    expect(projects.map((project) => project.id)).toEqual([second.id, first.id])
    expect(localStorage.getItem(LAST_OPEN_PROJECT_ID_KEY)).toBe(second.id)
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
})