import { expect, type Page } from '@playwright/test'

export const DRAFTS_STORAGE_KEY = 'rhyme-lines:persist:drafts'
export const LAST_OPEN_PROJECT_KEY = 'rhyme-lines:last-open-project-id'

export interface TestProject {
  id: string
  title: string
  content?: string
  createdAt?: number
  updatedAt?: number
  archived?: boolean
  archivedAt?: string | null
  deletedAt?: string | null
  isPinned?: boolean
  position?: number
}

const toDraft = (project: TestProject, index: number) => {
  const createdAt = project.createdAt ?? Date.now() + index
  const content = project.content ?? ''
  return {
    docId: project.id,
    title: project.title,
    createdAt,
    updatedAt: project.updatedAt ?? createdAt,
    lines: content.split('\n').map((text, lineIndex) => ({
      id: `${project.id}-line-${lineIndex}`,
      text,
    })),
    archived: project.archived ?? false,
    archivedAt: project.archivedAt ?? null,
    deletedAt: project.deletedAt ?? null,
    folderId: null,
    isPinned: project.isPinned ?? false,
    position: project.position ?? createdAt,
  }
}

export async function seedProjects(
  page: Page,
  projects: TestProject[],
  activeId: string | null = projects[0]?.id ?? null
) {
  await page.goto('/')
  const drafts = projects.map(toDraft)
  await page.evaluate(
    ({ drafts, activeId, draftsKey, lastOpenKey }) => {
      window.localStorage.clear()
      window.localStorage.setItem(
        draftsKey,
        JSON.stringify({ version: 2, data: { drafts, activeId, folders: [] } })
      )
      if (activeId) window.localStorage.setItem(lastOpenKey, activeId)
      window.localStorage.setItem('rhyme-lines:editor-sidebar-collapsed', 'false')
    },
    { drafts, activeId, draftsKey: DRAFTS_STORAGE_KEY, lastOpenKey: LAST_OPEN_PROJECT_KEY }
  )
}

export async function openProject(page: Page, id: string) {
  await page.goto(`/editor/${id}`)
  await expect(page).toHaveURL(new RegExp(`/editor/${id}(?:[?#].*)?$`))
  const editor = page.locator('#lyric-editor')
  await expect(editor).toBeVisible()
  return editor
}

export async function openTestEditor(
  page: Page,
  project: TestProject = { id: 'e2e-draft', title: 'E2E Draft' }
) {
  await seedProjects(page, [project], project.id)
  return openProject(page, project.id)
}

export async function readPersistedDrafts(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as {
      data?: { drafts?: Array<{ docId: string; title: string; lines: Array<{ text: string }> }> }
    }
    return parsed.data?.drafts ?? []
  }, DRAFTS_STORAGE_KEY)
}

export async function waitForPersistedDraft(
  page: Page,
  id: string,
  predicate: (draft: { docId: string; title: string; lines: Array<{ text: string }> }) => boolean
) {
  await expect.poll(async () => {
    const drafts = await readPersistedDrafts(page)
    const draft = drafts.find((candidate) => candidate.docId === id)
    return draft ? predicate(draft) : false
  }).toBe(true)
}
