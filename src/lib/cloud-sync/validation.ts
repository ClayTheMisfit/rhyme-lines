import type { CloudDocumentInput, CloudDocumentUpdateInput, CloudLifecycleAction } from './contracts'

export const MAX_CLOUD_REQUEST_BYTES = 1_100_000
export const MAX_CLOUD_CONTENT_CHARS = 1_000_000
export const MAX_CLOUD_LINES = 20_000

export class CloudPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CloudPayloadError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const requireString = (value: unknown, name: string, maxLength: number) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new CloudPayloadError(`${name} is invalid`)
  }
  return value
}

const requireTimestamp = (value: unknown, name: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 8_640_000_000_000_000) {
    throw new CloudPayloadError(`${name} is invalid`)
  }
  return value
}

const parseDocument = (value: unknown): CloudDocumentInput => {
  if (!isRecord(value)) throw new CloudPayloadError('Document payload is invalid')
  const clientDocumentId = requireString(value.clientDocumentId, 'clientDocumentId', 128)
  const title = requireString(value.title, 'title', 100)
  if (!Array.isArray(value.lines) || value.lines.length === 0 || value.lines.length > MAX_CLOUD_LINES) {
    throw new CloudPayloadError('lines is invalid')
  }
  let characters = 0
  const lines = value.lines.map((line, index) => {
    if (!isRecord(line)) throw new CloudPayloadError(`lines[${index}] is invalid`)
    const id = requireString(line.id, `lines[${index}].id`, 160)
    if (typeof line.text !== 'string') throw new CloudPayloadError(`lines[${index}].text is invalid`)
    characters += line.text.length
    if (characters > MAX_CLOUD_CONTENT_CHARS) throw new CloudPayloadError('content is too large')
    return { id, text: line.text }
  })
  const lifecycle = value.lifecycle
  if (lifecycle !== 'ACTIVE' && lifecycle !== 'ARCHIVED' && lifecycle !== 'TRASHED') {
    throw new CloudPayloadError('lifecycle is invalid')
  }
  const lifecycleChangedAt = value.lifecycleChangedAt
  if (lifecycleChangedAt !== null && (typeof lifecycleChangedAt !== 'string' || !Number.isFinite(Date.parse(lifecycleChangedAt)))) {
    throw new CloudPayloadError('lifecycleChangedAt is invalid')
  }
  if (typeof value.isPinned !== 'boolean') throw new CloudPayloadError('isPinned is invalid')
  if (typeof value.position !== 'number' || !Number.isFinite(value.position)) {
    throw new CloudPayloadError('position is invalid')
  }
  return {
    clientDocumentId,
    title,
    lines,
    clientCreatedAt: requireTimestamp(value.clientCreatedAt, 'clientCreatedAt'),
    clientUpdatedAt: requireTimestamp(value.clientUpdatedAt, 'clientUpdatedAt'),
    lifecycle,
    lifecycleChangedAt,
    isPinned: value.isPinned,
    position: value.position,
  }
}

export const parseCloudDocumentInput = (value: unknown): CloudDocumentInput => parseDocument(value)

export const parseCloudDocumentUpdateInput = (value: unknown): CloudDocumentUpdateInput => {
  const document = parseDocument(value)
  if (!isRecord(value) || !Number.isInteger(value.baseRevision) || (value.baseRevision as number) < 1) {
    throw new CloudPayloadError('baseRevision is invalid')
  }
  return { ...document, baseRevision: value.baseRevision as number }
}

export const parseLifecycleInput = (value: unknown): { action: CloudLifecycleAction; baseRevision: number } => {
  if (!isRecord(value)) throw new CloudPayloadError('Lifecycle payload is invalid')
  const actions: CloudLifecycleAction[] = ['archive', 'restore-archive', 'trash', 'restore-trash', 'delete-permanently']
  if (typeof value.action !== 'string' || !actions.includes(value.action as CloudLifecycleAction)) {
    throw new CloudPayloadError('action is invalid')
  }
  if (!Number.isInteger(value.baseRevision) || (value.baseRevision as number) < 1) {
    throw new CloudPayloadError('baseRevision is invalid')
  }
  return { action: value.action as CloudLifecycleAction, baseRevision: value.baseRevision as number }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_CLOUD_REQUEST_BYTES) {
    throw new CloudPayloadError('Request is too large')
  }
  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > MAX_CLOUD_REQUEST_BYTES) {
    throw new CloudPayloadError('Request is too large')
  }
  try {
    return JSON.parse(body) as unknown
  } catch {
    throw new CloudPayloadError('Request body must be valid JSON')
  }
}
