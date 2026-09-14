import 'server-only'

import type { CloudDocument as CloudDocumentRecord } from '@/generated/prisma/client'
import type { Prisma } from '@/generated/prisma/client'
import { getDatabase } from '@/lib/db'
import type {
  CloudConflictResponse,
  CloudDocumentDto,
  CloudDocumentInput,
  CloudDocumentListResponse,
  CloudDocumentUpdateInput,
  CloudLifecycleAction,
} from './contracts'

export class CloudDocumentNotFoundError extends Error {
  constructor() {
    super('Cloud document not found')
    this.name = 'CloudDocumentNotFoundError'
  }
}

export class CloudDocumentConflictError extends Error {
  readonly details: CloudConflictResponse

  constructor(documentId: string, expectedRevision: number, currentRevision: number) {
    super('Cloud document revision conflict')
    this.name = 'CloudDocumentConflictError'
    this.details = { error: 'conflict', documentId, expectedRevision, currentRevision }
  }
}

export class CloudDocumentTransitionError extends Error {
  constructor() {
    super('Cloud document lifecycle transition is not allowed')
    this.name = 'CloudDocumentTransitionError'
  }
}

const lifecycleTransition: Record<CloudLifecycleAction, { from: Array<CloudDocumentRecord['lifecycle']>; to: CloudDocumentRecord['lifecycle'] }> = {
  archive: { from: ['ACTIVE'], to: 'ARCHIVED' },
  'restore-archive': { from: ['ARCHIVED'], to: 'ACTIVE' },
  trash: { from: ['ACTIVE', 'ARCHIVED'], to: 'TRASHED' },
  'restore-trash': { from: ['TRASHED'], to: 'ACTIVE' },
  'delete-permanently': { from: ['TRASHED'], to: 'DELETED' },
}

const recordToDto = (record: CloudDocumentRecord): CloudDocumentDto => {
  const tombstone = record.lifecycle === 'DELETED'
  const content = record.content as { lines?: unknown }
  const lines = !tombstone && Array.isArray(content.lines)
    ? content.lines.filter((line): line is { id: string; text: string } => {
        if (!line || typeof line !== 'object') return false
        const candidate = line as { id?: unknown; text?: unknown }
        return typeof candidate.id === 'string' && typeof candidate.text === 'string'
      })
    : null
  return {
    id: record.id,
    clientDocumentId: record.clientDocumentId,
    title: tombstone ? null : record.title,
    lines,
    clientCreatedAt: record.clientCreatedAt.getTime(),
    clientUpdatedAt: record.clientUpdatedAt.getTime(),
    lifecycle: record.lifecycle,
    lifecycleChangedAt: record.lifecycleChangedAt?.toISOString() ?? null,
    isPinned: tombstone ? false : record.isPinned,
    position: record.position,
    revision: record.revision,
    deletedAt: record.deletedAt?.toISOString() ?? null,
    serverUpdatedAt: record.updatedAt.toISOString(),
  }
}

const writeData = (input: CloudDocumentInput) => ({
  title: input.title,
  content: { lines: input.lines } as Prisma.InputJsonValue,
  clientCreatedAt: new Date(input.clientCreatedAt),
  clientUpdatedAt: new Date(input.clientUpdatedAt),
  lifecycle: input.lifecycle,
  lifecycleChangedAt: input.lifecycleChangedAt ? new Date(input.lifecycleChangedAt) : null,
  isPinned: input.isPinned,
  position: input.position,
  deletedAt: input.lifecycle === 'TRASHED' && input.lifecycleChangedAt ? new Date(input.lifecycleChangedAt) : null,
})

async function currentOwnedRecord(userId: string, id: string) {
  return getDatabase().cloudDocument.findFirst({ where: { id, userId } })
}

export async function listCloudDocuments(userId: string): Promise<CloudDocumentListResponse> {
  const records = await getDatabase().cloudDocument.findMany({
    where: { userId },
    orderBy: [{ clientUpdatedAt: 'asc' }, { id: 'asc' }],
  })
  const converted = records.map(recordToDto)
  return {
    documents: converted.filter((record) => record.lifecycle !== 'DELETED'),
    tombstones: converted.filter((record) => record.lifecycle === 'DELETED'),
  }
}

export async function getCloudDocument(userId: string, id: string): Promise<CloudDocumentDto> {
  const record = await currentOwnedRecord(userId, id)
  if (!record) throw new CloudDocumentNotFoundError()
  return recordToDto(record)
}

export async function createCloudDocument(userId: string, input: CloudDocumentInput): Promise<CloudDocumentDto> {
  const data = writeData(input)
  const record = await getDatabase().cloudDocument.upsert({
    where: { userId_clientDocumentId: { userId, clientDocumentId: input.clientDocumentId } },
    create: { userId, clientDocumentId: input.clientDocumentId, ...data },
    update: {},
  })
  return recordToDto(record)
}

export async function updateCloudDocument(userId: string, id: string, input: CloudDocumentUpdateInput): Promise<CloudDocumentDto> {
  const records = await getDatabase().cloudDocument.updateManyAndReturn({
    where: { id, userId, clientDocumentId: input.clientDocumentId, revision: input.baseRevision, lifecycle: input.lifecycle },
    data: { ...writeData(input), revision: { increment: 1 } },
  })
  if (records.length === 1) return recordToDto(records[0])

  const current = await currentOwnedRecord(userId, id)
  if (!current) throw new CloudDocumentNotFoundError()
  if (current.clientDocumentId !== input.clientDocumentId) throw new CloudDocumentNotFoundError()
  throw new CloudDocumentConflictError(id, input.baseRevision, current.revision)
}

export async function transitionCloudDocument(
  userId: string,
  id: string,
  action: CloudLifecycleAction,
  baseRevision: number
): Promise<CloudDocumentDto> {
  const transition = lifecycleTransition[action]
  const now = new Date()
  const deleting = action === 'delete-permanently'
  const data: Prisma.CloudDocumentUpdateManyMutationInput = {
    lifecycle: transition.to,
    lifecycleChangedAt: now,
    deletedAt: transition.to === 'TRASHED' || transition.to === 'DELETED' ? now : null,
    revision: { increment: 1 },
    ...(deleting ? { title: 'Deleted document', content: { lines: [] }, isPinned: false } : {}),
  }
  const records = await getDatabase().cloudDocument.updateManyAndReturn({
    where: { id, userId, revision: baseRevision, lifecycle: { in: transition.from } },
    data,
  })
  if (records.length === 1) return recordToDto(records[0])

  const current = await currentOwnedRecord(userId, id)
  if (!current) throw new CloudDocumentNotFoundError()
  if (current.revision !== baseRevision) {
    throw new CloudDocumentConflictError(id, baseRevision, current.revision)
  }
  throw new CloudDocumentTransitionError()
}
