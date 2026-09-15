import { getCurrentUser } from '@/lib/auth/current-user'
import {
  checkpointCloudDocument,
  CloudDocumentConflictError,
  CloudDocumentNotFoundError,
  CloudHistoryCursorError,
  listCloudDocumentVersions,
} from '@/lib/cloud-sync/service'
import {
  CloudPayloadError,
  parseCheckpointInput,
  parseHistoryPage,
  readJsonBody,
} from '@/lib/cloud-sync/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }
type Context = { params: Promise<{ id: string }> }

const errorResponse = (error: unknown) => {
  if (error instanceof CloudPayloadError || error instanceof CloudHistoryCursorError) {
    return Response.json({ error: error.message }, { status: 400, headers })
  }
  if (error instanceof CloudDocumentNotFoundError) return Response.json({ error: 'Not found' }, { status: 404, headers })
  if (error instanceof CloudDocumentConflictError) return Response.json(error.details, { status: 409, headers })
  return Response.json({ error: 'Version history is temporarily unavailable' }, { status: 503, headers })
}

export async function GET(request: Request, { params }: Context) {
  try {
    const user = await getCurrentUser()
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401, headers })
    const { id } = await params
    return Response.json(await listCloudDocumentVersions(user.id, id, parseHistoryPage(request)), { headers })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const user = await getCurrentUser()
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401, headers })
    const { expectedRevision } = parseCheckpointInput(await readJsonBody(request))
    const { id } = await params
    const version = await checkpointCloudDocument(user.id, id, expectedRevision)
    return Response.json({ version }, { status: 201, headers })
  } catch (error) {
    return errorResponse(error)
  }
}
