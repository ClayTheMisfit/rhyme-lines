import { readWithMigrations, writeVersioned } from '@/lib/persist/storage'
import { type DraftCollection, type DraftSchema, type FolderSchema } from '@/lib/persist/schema'
import { analyzeProjectContent } from '@/lib/projects/analysis'

const LAST_OPEN_PROJECT_ID_KEY = 'rhyme-lines:last-open-project-id'

export interface ProjectDocument {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  archived: boolean
  archivedAt?: string | null
  deletedAt: string | null
  folderId: string | null
}

export interface ProjectSummary {
  id: string
  title: string
  preview: string
  createdAt: string
  updatedAt: string
  archived: boolean
  archivedAt?: string | null
  deletedAt: string | null
  folderId: string | null
  folderName?: string | null
  wordCount: number
  lineCount: number
  rhymeDensity: number
  internalRhymes: number
  endRhymeFamilyCount: number
  averageSyllablesPerLine: number
}

export interface ProjectFolder {
  id: string
  name: string
  createdAt: string
  updatedAt: string
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

const parseDraft = (
  draft: DraftSchema,
  existing?: Pick<ProjectDocument, 'archived' | 'archivedAt'>
): ProjectDocument => {
  const draftArchived = typeof draft.archived === 'boolean' ? draft.archived : undefined
  const existingArchived = typeof existing?.archived === 'boolean' ? existing.archived : undefined
  const archived: boolean = draftArchived ?? existingArchived ?? false

  const draftArchivedAt = typeof draft.archivedAt === 'string' ? draft.archivedAt : null
  const existingArchivedAt = typeof existing?.archivedAt === 'string' ? existing.archivedAt : null
  const archivedAt = archived ? draftArchivedAt ?? existingArchivedAt : null

  return {
    id: draft.docId,
    title: draft.title?.trim() || 'Untitled',
    content: draft.lines.map((line) => line.text).join('\n'),
    createdAt: toIso(draft.createdAt),
    updatedAt: toIso(draft.updatedAt),
    archived,
    archivedAt,
    deletedAt: typeof draft.deletedAt === 'string' ? draft.deletedAt : null,
    folderId: typeof draft.folderId === 'string' ? draft.folderId : null,
  }
}

const toSummary = (project: ProjectDocument, folders: ProjectFolder[]): ProjectSummary => {
  const analysis = analyzeProjectContent(project.content)
  return {
    id: project.id,
    title: project.title,
    preview: previewFromContent(project.content),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    archived: project.archived === true,
    archivedAt: typeof project.archivedAt === 'string' ? project.archivedAt : null,
    deletedAt: typeof project.deletedAt === 'string' ? project.deletedAt : null,
    folderId: typeof project.folderId === 'string' ? project.folderId : null,
    folderName: folders.find((folder) => folder.id === project.folderId)?.name ?? null,
    wordCount: countWords(project.content),
    lineCount: countLines(project.content),
    rhymeDensity: analysis.rhymeDensity,
    internalRhymes: analysis.internalRhymes,
    endRhymeFamilyCount: analysis.endRhymeFamilyCount,
    averageSyllablesPerLine: analysis.averageSyllablesPerLine,
  }
}

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
    archived: project.archived === true,
    archivedAt: typeof project.archivedAt === 'string' ? project.archivedAt : null,
    deletedAt: typeof project.deletedAt === 'string' ? project.deletedAt : null,
    folderId: typeof project.folderId === 'string' ? project.folderId : null,
    lines: lines.length ? lines : [{ id: `${project.id}-line-0`, text: '' }],
    selection: previous?.selection,
  }
}

const readCollection = (): DraftCollection => readWithMigrations('drafts').data

const writeCollection = (collection: DraftCollection) => writeVersioned('drafts', collection)

const toFolder = (folder: FolderSchema): ProjectFolder => ({
  id: folder.id,
  name: folder.name.trim(),
  createdAt: folder.createdAt,
  updatedAt: folder.updatedAt,
})

const sortByUpdated = (projects: ProjectSummary[]) =>
  [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))

const sortByDeletedAt = (projects: ProjectSummary[]) =>
  [...projects].sort((a, b) => {
    const deletedAtA = a.deletedAt ? Date.parse(a.deletedAt) : Number.NaN
    const deletedAtB = b.deletedAt ? Date.parse(b.deletedAt) : Number.NaN
    const hasDeletedAtA = Number.isFinite(deletedAtA)
    const hasDeletedAtB = Number.isFinite(deletedAtB)
    if (hasDeletedAtA && hasDeletedAtB) return deletedAtB - deletedAtA
    if (hasDeletedAtA) return -1
    if (hasDeletedAtB) return 1
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  })

const normalizeProject = (project: ProjectSummary): ProjectSummary => ({
  ...project,
  archived: project.archived === true,
  archivedAt: typeof project.archivedAt === 'string' ? project.archivedAt : null,
  deletedAt: typeof project.deletedAt === 'string' ? project.deletedAt : null,
  folderId: typeof project.folderId === 'string' ? project.folderId : null,
  folderName: typeof project.folderName === 'string' ? project.folderName : null,
})

const sortArchived = (projects: ProjectSummary[]) =>
  [...projects].sort((a, b) => {
    const archivedAtA = a.archivedAt ? Date.parse(a.archivedAt) : Number.NaN
    const archivedAtB = b.archivedAt ? Date.parse(b.archivedAt) : Number.NaN
    const hasArchivedAtA = Number.isFinite(archivedAtA)
    const hasArchivedAtB = Number.isFinite(archivedAtB)
    if (hasArchivedAtA && hasArchivedAtB) return archivedAtB - archivedAtA
    if (hasArchivedAtA) return -1
    if (hasArchivedAtB) return 1
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  })

export const listProjectSummaries = (): ProjectSummary[] => {
  const collection = readCollection()
  const drafts = filterMeaningfulDrafts(collection.drafts)
  const folders = (collection.folders ?? []).map(toFolder)
  return sortByUpdated(drafts.map((draft) => normalizeProject(toSummary(parseDraft(draft), folders))))
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
    archived: false,
    archivedAt: null,
    deletedAt: null,
    folderId: null,
  }

  const collection = readCollection()
  const existingDrafts = filterMeaningfulDrafts(collection.drafts)
  const draft = toDraft(project)
  writeCollection({ drafts: [...existingDrafts, draft], activeId: project.id, folders: collection.folders ?? [] })
  setLastOpenProjectId(project.id)
  return project
}

export const deleteProject = (id: string): void => {
  const collection = readCollection()
  const drafts = collection.drafts.filter((draft) => draft.docId !== id)
  const activeId = drafts.find((draft) => draft.docId === collection.activeId)?.docId ?? drafts[0]?.docId ?? ''
  writeCollection({ drafts, activeId, folders: collection.folders ?? [] })
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
  sortByUpdated(
    filterMeaningfulDrafts(collection.drafts).map((draft) =>
      normalizeProject(toSummary(parseDraft(draft), (collection.folders ?? []).map(toFolder)))
    )
  )

export const archiveProject = (id: string): void => {
  const collection = readCollection()
  const archivedAt = new Date().toISOString()
  const drafts = collection.drafts.map((draft) => {
    if (draft.docId !== id) return draft
    return {
      ...draft,
      archived: true,
      archivedAt,
    }
  })
  writeCollection({ drafts, activeId: collection.activeId, folders: collection.folders ?? [] })
}

export const restoreProject = (id: string): void => {
  const collection = readCollection()
  const drafts = collection.drafts.map((draft) => {
    if (draft.docId !== id) return draft
    return {
      ...draft,
      archived: false,
      archivedAt: null,
    }
  })
  writeCollection({ drafts, activeId: collection.activeId, folders: collection.folders ?? [] })
}

export const listActiveProjectSummaries = (): ProjectSummary[] =>
  sortByUpdated(listProjectSummaries().filter((project) => project.archived !== true && !project.deletedAt))

export const listArchivedProjectSummaries = (): ProjectSummary[] =>
  sortArchived(listProjectSummaries().filter((project) => project.archived === true && !project.deletedAt))

export const listTrashProjectSummaries = (): ProjectSummary[] =>
  sortByDeletedAt(listProjectSummaries().filter((project) => !!project.deletedAt))

export const renameProject = (id: string, title: string): void => {
  const normalizedTitle = title.trim() || 'Untitled Project'
  const collection = readCollection()
  const drafts = collection.drafts.map((draft) => {
    if (draft.docId !== id) return draft
    return {
      ...draft,
      title: normalizedTitle,
      updatedAt: Date.now(),
    }
  })
  writeCollection({ drafts, activeId: collection.activeId, folders: collection.folders ?? [] })
}

export const moveProjectToTrash = (id: string): void => {
  const collection = readCollection()
  const deletedAt = new Date().toISOString()
  const drafts = collection.drafts.map((draft) => {
    if (draft.docId !== id) return draft
    return {
      ...draft,
      deletedAt,
    }
  })
  writeCollection({ drafts, activeId: collection.activeId, folders: collection.folders ?? [] })
}

export const restoreProjectFromTrash = (id: string): void => {
  const collection = readCollection()
  const drafts = collection.drafts.map((draft) => {
    if (draft.docId !== id) return draft
    return {
      ...draft,
      deletedAt: null,
      archived: false,
      archivedAt: null,
    }
  })
  writeCollection({ drafts, activeId: collection.activeId, folders: collection.folders ?? [] })
}

export const permanentlyDeleteProject = (id: string): void => {
  const collection = readCollection()
  const drafts = collection.drafts.filter((draft) => draft.docId !== id)
  const activeId = drafts.find((draft) => draft.docId === collection.activeId)?.docId ?? drafts[0]?.docId ?? ''
  writeCollection({ drafts, activeId, folders: collection.folders ?? [] })
  if (getLastOpenProjectId() === id) setLastOpenProjectId(activeId || null)
}

export const listFolders = (): ProjectFolder[] => {
  const collection = readCollection()
  return (collection.folders ?? []).map(toFolder).sort((a, b) => a.name.localeCompare(b.name))
}

export const createFolder = (name: string): ProjectFolder | null => {
  const normalizedName = name.trim()
  if (!normalizedName) return null
  const collection = readCollection()
  const now = new Date().toISOString()
  const folder: ProjectFolder = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `folder-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`,
    name: normalizedName,
    createdAt: now,
    updatedAt: now,
  }
  writeCollection({ drafts: collection.drafts, activeId: collection.activeId, folders: [...(collection.folders ?? []), folder] })
  return folder
}

export const renameFolder = (id: string, name: string): void => {
  const normalizedName = name.trim()
  if (!normalizedName) return
  const collection = readCollection()
  const folders = (collection.folders ?? []).map((folder) => {
    if (folder.id !== id) return folder
    return { ...folder, name: normalizedName, updatedAt: new Date().toISOString() }
  })
  writeCollection({ drafts: collection.drafts, activeId: collection.activeId, folders })
}

export const assignProjectFolder = (id: string, folderId: string | null): void => {
  const collection = readCollection()
  const drafts = collection.drafts.map((draft) => {
    if (draft.docId !== id) return draft
    return {
      ...draft,
      folderId,
      updatedAt: Date.now(),
    }
  })
  writeCollection({ drafts, activeId: collection.activeId, folders: collection.folders ?? [] })
}

export const getProjectCounts = () => {
  const all = listProjectSummaries()
  return {
    archived: all.filter((project) => project.archived === true && !project.deletedAt).length,
    trash: all.filter((project) => !!project.deletedAt).length,
  }
}

export const filterProjectSummaries = (
  projects: ProjectSummary[],
  search: string,
  folderId: string | null,
  folders: ProjectFolder[]
): ProjectSummary[] => {
  const normalizedSearch = search.trim().toLowerCase()
  const folderNameMap = new Map(folders.map((folder) => [folder.id, folder.name.toLowerCase()]))
  return projects.filter((project) => {
    const matchesFolder =
      folderId === null ? true : folderId === '__none__' ? !project.folderId : project.folderId === folderId
    if (!matchesFolder) return false
    if (!normalizedSearch) return true
    const folderName = project.folderId ? folderNameMap.get(project.folderId) ?? '' : ''
    return (
      project.title.toLowerCase().includes(normalizedSearch) ||
      project.preview.toLowerCase().includes(normalizedSearch) ||
      folderName.includes(normalizedSearch)
    )
  })
}

export { LAST_OPEN_PROJECT_ID_KEY }
