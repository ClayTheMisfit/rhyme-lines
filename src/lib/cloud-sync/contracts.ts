export const CLOUD_DOCUMENT_LIFECYCLES = ['ACTIVE', 'ARCHIVED', 'TRASHED', 'DELETED'] as const
export type CloudDocumentLifecycle = (typeof CLOUD_DOCUMENT_LIFECYCLES)[number]

export type CloudDocumentLine = { id: string; text: string }

export type CloudDocumentInput = {
  clientDocumentId: string
  title: string
  lines: CloudDocumentLine[]
  clientCreatedAt: number
  clientUpdatedAt: number
  lifecycle: Exclude<CloudDocumentLifecycle, 'DELETED'>
  lifecycleChangedAt: string | null
  isPinned: boolean
  position: number
}

export type CloudDocumentUpdateInput = CloudDocumentInput & { baseRevision: number }
export type CloudLifecycleAction = 'archive' | 'restore-archive' | 'trash' | 'restore-trash' | 'delete-permanently'

export type CloudDocumentDto = {
  id: string
  clientDocumentId: string
  title: string | null
  lines: CloudDocumentLine[] | null
  clientCreatedAt: number
  clientUpdatedAt: number
  lifecycle: CloudDocumentLifecycle
  lifecycleChangedAt: string | null
  isPinned: boolean
  position: number
  revision: number
  deletedAt: string | null
  serverUpdatedAt: string
}

export type CloudDocumentListResponse = {
  documents: CloudDocumentDto[]
  tombstones: CloudDocumentDto[]
}

export type CloudConflictResponse = {
  error: 'conflict'
  documentId: string
  expectedRevision: number
  currentRevision: number
}
