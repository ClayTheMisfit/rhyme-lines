import { readWithMigrations, writeVersioned } from '@/lib/persist/storage'
import { type DraftCollection, type DraftSchema } from '@/lib/persist/schema'

const LAST_OPEN_PROJECT_ID_KEY = 'rhyme-lines:last-open-project-id'
const PROJECT_META_KEY = 'rhyme-lines:projects:meta:v1'

type ProjectMeta = {
  archived: boolean
  archivedAt: string | null
}

type ProjectMetaRecord = Record<string, ProjectMeta>

type ProjectView = 'active' | 'archived' | 'all'

export interface ProjectDocument {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  archived: boolean
  archivedAt?: string | null
}

export interface ProjectSummary {
  id: string
  title: string
  preview: string
  createdAt: string
  updatedAt: string
  wordCount: number
  lineCount: number
  archived: boolean
  archivedAt?: string | null
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

const readMetaRecord = (): ProjectMetaRecord => {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(PROJECT_META_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.fromEntries(
      Object.entries(parsed).map(([id, value]) => {
        const meta = value as { archived?: unknown; archivedAt?: unknown }
        return [
          id,
          {
            archived: meta.archived === true,
            archivedAt: typeof meta.archivedAt === 'string' ? meta.archivedAt : null,
          },
        ]
      })
    )
  } catch {
    return {}
  }
}

const writeMetaRecord = (record: ProjectMetaRecord) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PROJECT_META_KEY, JSON.stringify(record))
}

const getProjectMeta = (record: ProjectMetaRecord, projectId: string): ProjectMeta => {
  const existing = record[projectId]
  if (!existing) return { archived: false, archivedAt: null }
  return {
    archived: existing.archived === true,
    archivedAt: existing.archived ? existing.archivedAt ?? null : null,
  }
}

const parseDraft = (draft: DraftSchema, metaRecord: ProjectMetaRecord): ProjectDocument => {
  const meta = getProjectMeta(metaRecord, draft.docId)
  return {
    id: draft.docId,
    title: draft.title?.trim() || 'Untitled',
    content: draft.lines.map((line) => line.text).join('\n'),
    createdAt: toIso(draft.createdAt),
    updatedAt: toIso(draft.updatedAt),
    archived: meta.archived,
    archivedAt: meta.archivedAt,
  }
}

const toSummary = (project: ProjectDocument): ProjectSummary => ({
  id: project.id,
  title: project.title,
  preview: previewFromContent(project.content),
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  wordCount: countWords(project.content),
  lineCount: countLines(project.content),
  archived: project.archived,
  archivedAt: project.archivedAt ?? null,
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

const sortByArchived = (projects: ProjectSummary[]) =>
  [...projects].sort((a, b) => {
    const archivedAtDelta = Date.parse(b.archivedAt ?? '') - Date.parse(a.archivedAt ?? '')
    if (Number.isFinite(archivedAtDelta) && archivedAtDelta !== 0) return archivedAtDelta
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  })

const applyView = (projects: ProjectSummary[], view: ProjectView): ProjectSummary[] => {
  if (view === 'active') {
    return sortByUpdated(projects.filter((project) => project.archived !== true))
  }
  if (view === 'archived') {
    return sortByArchived(projects.filter((project) => project.archived === true))
  }
  return sortByUpdated(projects)
}

export const listProjectSummaries = (view: ProjectView = 'active'): ProjectSummary[] => {
  const collection = readCollection()
  const meta = readMetaRecord()
  const drafts = filterMeaningfulDrafts(collection.drafts)
  const summaries = drafts.map((draft) => toSummary(parseDraft(draft, meta)))
  return applyView(summaries, view)
}

export const createProject = (title = 'Untitled'): ProjectDocument => {
  const now = new Date().toISOString()
  const project: ProjectDocument = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `project-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`,
    title,
    content: '',
    createdAt: now,
    updatedAt: now,
    archived: false,
    archivedAt: null,
  }

  const collection = readCollection()
  const existingDrafts = filterMeaningfulDrafts(collection.drafts)
  const draft = toDraft(project)
  writeCollection({ drafts: [...existingDrafts, draft], activeId: project.id })

  const meta = readMetaRecord()
  meta[project.id] = { archived: false, archivedAt: null }
  writeMetaRecord(meta)

  setLastOpenProjectId(project.id)
  return project
}

export const archiveProject = (id: string): void => {
  const meta = readMetaRecord()
  meta[id] = { archived: true, archivedAt: new Date().toISOString() }
  writeMetaRecord(meta)
}

export const restoreProject = (id: string): void => {
  const meta = readMetaRecord()
  meta[id] = { archived: false, archivedAt: null }
  writeMetaRecord(meta)
}

export const deleteProject = (id: string): void => {
  const collection = readCollection()
  const drafts = collection.drafts.filter((draft) => draft.docId !== id)
  const activeId = drafts.find((draft) => draft.docId === collection.activeId)?.docId ?? drafts[0]?.docId ?? ''
  writeCollection({ drafts, activeId })

  const meta = readMetaRecord()
  delete meta[id]
  writeMetaRecord(meta)

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

export const summariesFromCollection = (collection: DraftCollection): ProjectSummary[] => {
  const meta = readMetaRecord()
  return applyView(
    filterMeaningfulDrafts(collection.drafts).map((draft) => toSummary(parseDraft(draft, meta))),
    'all'
  )
}

export { LAST_OPEN_PROJECT_ID_KEY, PROJECT_META_KEY }
