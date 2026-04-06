import { readWithMigrations, writeVersioned } from '@/lib/persist/storage'
import { type DraftCollection, type DraftSchema } from '@/lib/persist/schema'

const LAST_OPEN_PROJECT_ID_KEY = 'rhyme-lines:last-open-project-id'

export interface ProjectDocument {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  title: string
  preview: string
  createdAt: string
  updatedAt: string
  wordCount: number
  lineCount: number
}

const toIso = (timestamp: number) => new Date(timestamp).toISOString()

const normalizeContent = (content: string) => content.replace(/\r\n?/g, '\n')

const fromIso = (value: string, fallback = Date.now()) => {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const countLines = (content: string) => normalizeContent(content).split('\n').length

const countWords = (content: string) => {
  const words = normalizeContent(content)
    .trim()
    .match(/\S+/g)
  return words?.length ?? 0
}

const previewFromContent = (content: string) => normalizeContent(content).replace(/\s+/g, ' ').trim().slice(0, 140)


const hasContent = (draft: DraftSchema) => draft.lines.some((line) => line.text.trim().length > 0)

const isPlaceholderDraft = (draft: DraftSchema) => {
  const normalizedTitle = draft.title?.trim() || 'Untitled'
  return normalizedTitle === 'Untitled' && !hasContent(draft)
}

const filterMeaningfulDrafts = (drafts: DraftSchema[]) => {
  if (drafts.length === 1 && isPlaceholderDraft(drafts[0])) {
    return []
  }
  return drafts
}

const parseDraft = (draft: DraftSchema): ProjectDocument => ({
  id: draft.docId,
  title: draft.title?.trim() || 'Untitled',
  content: draft.lines.map((line) => line.text).join('\n'),
  createdAt: toIso(draft.createdAt),
  updatedAt: toIso(draft.updatedAt),
})

const toSummary = (project: ProjectDocument): ProjectSummary => ({
  id: project.id,
  title: project.title,
  preview: previewFromContent(project.content),
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  wordCount: countWords(project.content),
  lineCount: countLines(project.content),
})

const toDraft = (project: ProjectDocument, previous?: DraftSchema): DraftSchema => {
  const normalized = normalizeContent(project.content)
  const lines = normalized.split('\n').map((text, index) => ({
    id: previous?.lines[index]?.id ?? `${project.id}-line-${index}`,
    text,
  }))

  return {
    docId: project.id,
    title: project.title.trim() || 'Untitled',
    createdAt: fromIso(project.createdAt),
    updatedAt: fromIso(project.updatedAt),
    lines: lines.length ? lines : [{ id: `${project.id}-line-0`, text: '' }],
    selection: previous?.selection,
  }
}

const readCollection = (): DraftCollection => readWithMigrations('drafts').data

const writeCollection = (collection: DraftCollection) => writeVersioned('drafts', collection)

const sortByUpdated = (projects: ProjectSummary[]) =>
  [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))

export const listProjectSummaries = (): ProjectSummary[] => {
  const collection = readCollection()
  const drafts = filterMeaningfulDrafts(collection.drafts)
  return sortByUpdated(drafts.map((draft) => toSummary(parseDraft(draft))))
}

export const createProject = (title = 'Untitled'): ProjectDocument => {
  const now = new Date().toISOString()
  const project: ProjectDocument = {
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `project-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`,
    title,
    content: '',
    createdAt: now,
    updatedAt: now,
  }

  const collection = readCollection()
  const existingDrafts = filterMeaningfulDrafts(collection.drafts)
  const draft = toDraft(project)
  writeCollection({ drafts: [...existingDrafts, draft], activeId: project.id })
  setLastOpenProjectId(project.id)
  return project
}

export const deleteProject = (id: string): void => {
  const collection = readCollection()
  const drafts = collection.drafts.filter((draft) => draft.docId !== id)
  const activeId = drafts.find((draft) => draft.docId === collection.activeId)?.docId ?? drafts[0]?.docId ?? ''
  writeCollection({ drafts, activeId })
  if (getLastOpenProjectId() === id) setLastOpenProjectId(activeId || null)
}

export const setLastOpenProjectId = (id: string | null) => {
  if (typeof window === 'undefined') return
  if (id) {
    window.localStorage.setItem(LAST_OPEN_PROJECT_ID_KEY, id)
  } else {
    window.localStorage.removeItem(LAST_OPEN_PROJECT_ID_KEY)
  }
}

export const getLastOpenProjectId = (): string | null => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(LAST_OPEN_PROJECT_ID_KEY)
}

export const summariesFromCollection = (collection: DraftCollection): ProjectSummary[] =>
  sortByUpdated(filterMeaningfulDrafts(collection.drafts).map((draft) => toSummary(parseDraft(draft))))

export { LAST_OPEN_PROJECT_ID_KEY }
