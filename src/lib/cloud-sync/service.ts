import 'server-only'

import type {
  CloudDocument as CloudDocumentRecord,
  CloudDocumentVersion as CloudDocumentVersionRecord,
  CloudDocumentVersionReason,
} from '@/generated/prisma/client'
import type { Prisma } from '@/generated/prisma/client'
import { getDatabase } from '@/lib/db'
import type {
  CloudConflictResponse,
  CloudDocumentDto,
  CloudDocumentInput,
  CloudDocumentListResponse,
  CloudDocumentUpdateInput,
  CloudDocumentVersionDto,
  CloudDocumentVersionListResponse,
  CloudDocumentVersionMetadata,
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

export class CloudHistoryCursorError extends Error {
  constructor() {
    super('History cursor is invalid')
    this.name = 'CloudHistoryCursorError'
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

const versionLines = (content: Prisma.JsonValue): CloudDocumentDto['lines'] => {
  const value = content as { lines?: unknown }
  if (!Array.isArray(value.lines)) return []
  return value.lines.filter((line): line is { id: string; text: string } => {
    if (!line || typeof line !== 'object') return false
    const candidate = line as { id?: unknown; text?: unknown }
    return typeof candidate.id === 'string' && typeof candidate.text === 'string'
  })
}

type VersionMetadataRecord = Pick<
  CloudDocumentVersionRecord,
  'id' | 'sourceRevision' | 'title' | 'lifecycle' | 'reason' | 'createdAt'
>

const versionToMetadata = (record: VersionMetadataRecord): CloudDocumentVersionMetadata => ({
  id: record.id,
  sourceRevision: record.sourceRevision,
  title: record.title,
  lifecycle: record.lifecycle,
  reason: record.reason,
  createdAt: record.createdAt.toISOString(),
})

const versionToDto = (record: CloudDocumentVersionRecord): CloudDocumentVersionDto => ({
  ...versionToMetadata(record),
  documentId: record.documentId,
  lines: versionLines(record.content) ?? [],
  lifecycleChangedAt: record.lifecycleChangedAt?.toISOString() ?? null,
  isPinned: record.isPinned,
  position: record.position,
  clientCreatedAt: record.clientCreatedAt.getTime(),
  clientUpdatedAt: record.clientUpdatedAt.getTime(),
})

const snapshotData = (
  record: CloudDocumentRecord,
  reason: CloudDocumentVersionReason
): Prisma.CloudDocumentVersionUncheckedCreateInput => ({
  documentId: record.id,
  userId: record.userId,
  sourceRevision: record.revision,
  title: record.title,
  content: record.content as Prisma.InputJsonValue,
  lifecycle: record.lifecycle,
  lifecycleChangedAt: record.lifecycleChangedAt,
  isPinned: record.isPinned,
  position: record.position,
  clientCreatedAt: record.clientCreatedAt,
  clientUpdatedAt: record.clientUpdatedAt,
  reason,
})

// Multi-query history transactions may include a row-lock wait and remote DB latency.
const HISTORY_TRANSACTION_OPTIONS = { timeout: 15_000 }

type HistoryCursor = { createdAt: string; id: string }

const encodeHistoryCursor = (record: Pick<CloudDocumentVersionRecord, 'createdAt' | 'id'>) =>
  Buffer.from(JSON.stringify({ createdAt: record.createdAt.toISOString(), id: record.id } satisfies HistoryCursor)).toString('base64url')

const decodeHistoryCursor = (cursor: string): { createdAt: Date; id: string } => {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<HistoryCursor>
    const createdAt = typeof parsed.createdAt === 'string' ? new Date(parsed.createdAt) : new Date(Number.NaN)
    if (!parsed.id || parsed.id.length > 128 || Number.isNaN(createdAt.getTime())) throw new Error('invalid')
    return { createdAt, id: parsed.id }
  } catch {
    throw new CloudHistoryCursorError()
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

async function lockHistoryDocument(transaction: Prisma.TransactionClient, userId: string, id: string) {
  // Serialize snapshot writers with lifecycle updates and the permanent-delete purge.
  await transaction.$queryRaw`SELECT "id" FROM "CloudDocument" WHERE "id" = ${id} AND "userId" = ${userId} FOR UPDATE`
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
  const record = await getDatabase().$transaction(async (transaction) => {
    const current = await transaction.cloudDocument.upsert({
      where: { userId_clientDocumentId: { userId, clientDocumentId: input.clientDocumentId } },
      create: { userId, clientDocumentId: input.clientDocumentId, ...data },
      update: {},
    })
    await lockHistoryDocument(transaction, userId, current.id)
    const latest = await transaction.cloudDocument.findUniqueOrThrow({ where: { id: current.id } })
    if (latest.lifecycle !== 'DELETED') {
      await transaction.cloudDocumentVersion.createMany({
        data: [snapshotData(latest, 'INITIAL')],
        skipDuplicates: true,
      })
    }
    return latest
  }, HISTORY_TRANSACTION_OPTIONS)
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
  return getDatabase().$transaction(async (transaction) => {
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
    const records = await transaction.cloudDocument.updateManyAndReturn({
      where: { id, userId, revision: baseRevision, lifecycle: { in: transition.from } },
      data,
    })
    if (records.length !== 1) {
      const current = await transaction.cloudDocument.findFirst({ where: { id, userId } })
      if (!current) throw new CloudDocumentNotFoundError()
      if (current.revision !== baseRevision) throw new CloudDocumentConflictError(id, baseRevision, current.revision)
      throw new CloudDocumentTransitionError()
    }
    const updated = records[0]
    if (deleting) {
      await transaction.cloudDocumentVersion.deleteMany({ where: { documentId: id, userId } })
    } else {
      await transaction.cloudDocumentVersion.createMany({
        data: [snapshotData(updated, 'LIFECYCLE')],
        skipDuplicates: true,
      })
    }
    return recordToDto(updated)
  }, HISTORY_TRANSACTION_OPTIONS)
}

export async function checkpointCloudDocument(
  userId: string,
  id: string,
  expectedRevision: number
): Promise<CloudDocumentVersionMetadata> {
  return getDatabase().$transaction(async (transaction) => {
    await lockHistoryDocument(transaction, userId, id)
    const current = await transaction.cloudDocument.findFirst({
      where: { id, userId, lifecycle: { not: 'DELETED' } },
    })
    if (!current) throw new CloudDocumentNotFoundError()
    if (current.revision !== expectedRevision) {
      throw new CloudDocumentConflictError(id, expectedRevision, current.revision)
    }
    const existingCount = await transaction.cloudDocumentVersion.count({ where: { documentId: id, userId } })
    await transaction.cloudDocumentVersion.createMany({
      data: [snapshotData(current, existingCount === 0 ? 'INITIAL' : 'AUTO')],
      skipDuplicates: true,
    })
    const version = await transaction.cloudDocumentVersion.findUniqueOrThrow({
      where: { documentId_sourceRevision: { documentId: id, sourceRevision: current.revision } },
    })
    return versionToMetadata(version)
  }, HISTORY_TRANSACTION_OPTIONS)
}

export async function listCloudDocumentVersions(
  userId: string,
  documentId: string,
  options: { cursor: string | null; limit: number }
): Promise<CloudDocumentVersionListResponse> {
  const document = await getDatabase().cloudDocument.findFirst({
    where: { id: documentId, userId, lifecycle: { not: 'DELETED' } },
    select: { id: true },
  })
  if (!document) throw new CloudDocumentNotFoundError()
  const cursor = options.cursor ? decodeHistoryCursor(options.cursor) : null
  const versions = await getDatabase().cloudDocumentVersion.findMany({
    where: {
      documentId,
      userId,
      ...(cursor ? {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: options.limit + 1,
    select: {
      id: true,
      sourceRevision: true,
      title: true,
      lifecycle: true,
      reason: true,
      createdAt: true,
    },
  })
  const hasMore = versions.length > options.limit
  const page = hasMore ? versions.slice(0, options.limit) : versions
  return {
    versions: page.map(versionToMetadata),
    nextCursor: hasMore && page.length ? encodeHistoryCursor(page[page.length - 1]) : null,
  }
}

export async function getCloudDocumentVersion(
  userId: string,
  documentId: string,
  versionId: string
): Promise<CloudDocumentVersionDto> {
  const document = await getDatabase().cloudDocument.findFirst({
    where: { id: documentId, userId, lifecycle: { not: 'DELETED' } },
    select: { id: true },
  })
  if (!document) throw new CloudDocumentNotFoundError()
  const version = await getDatabase().cloudDocumentVersion.findFirst({
    where: { id: versionId, documentId, userId },
  })
  if (!version) throw new CloudDocumentNotFoundError()
  return versionToDto(version)
}

export async function restoreCloudDocumentVersion(
  userId: string,
  documentId: string,
  versionId: string,
  baseRevision: number
): Promise<{ document: CloudDocumentDto; version: CloudDocumentVersionMetadata }> {
  return getDatabase().$transaction(async (transaction) => {
    await lockHistoryDocument(transaction, userId, documentId)
    const current = await transaction.cloudDocument.findFirst({
      where: { id: documentId, userId, lifecycle: { not: 'DELETED' } },
    })
    if (!current) throw new CloudDocumentNotFoundError()
    if (current.revision !== baseRevision) {
      throw new CloudDocumentConflictError(documentId, baseRevision, current.revision)
    }
    const selected = await transaction.cloudDocumentVersion.findFirst({
      where: { id: versionId, documentId, userId },
    })
    if (!selected) throw new CloudDocumentNotFoundError()

    await transaction.cloudDocumentVersion.createMany({
      data: [snapshotData(current, 'PRE_RESTORE')],
      skipDuplicates: true,
    })

    const restoredRecords = await transaction.cloudDocument.updateManyAndReturn({
      where: { id: documentId, userId, revision: baseRevision, lifecycle: { not: 'DELETED' } },
      data: {
        title: selected.title,
        content: selected.content as Prisma.InputJsonValue,
        lifecycle: selected.lifecycle,
        lifecycleChangedAt: selected.lifecycleChangedAt,
        isPinned: selected.isPinned,
        position: selected.position,
        clientCreatedAt: selected.clientCreatedAt,
        clientUpdatedAt: selected.clientUpdatedAt,
        deletedAt: selected.lifecycle === 'TRASHED' ? selected.lifecycleChangedAt : null,
        revision: { increment: 1 },
      },
    })
    if (restoredRecords.length !== 1) {
      const latest = await transaction.cloudDocument.findFirst({ where: { id: documentId, userId } })
      if (!latest) throw new CloudDocumentNotFoundError()
      throw new CloudDocumentConflictError(documentId, baseRevision, latest.revision)
    }
    const restored = restoredRecords[0]
    const restoreVersion = await transaction.cloudDocumentVersion.create({
      data: snapshotData(restored, 'RESTORE'),
    })
    return { document: recordToDto(restored), version: versionToMetadata(restoreVersion) }
  }, HISTORY_TRANSACTION_OPTIONS)
}
