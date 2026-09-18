import { getCurrentUser } from '@/lib/auth/current-user'
import {
  CloudDocumentConflictError,
  CloudDocumentNotFoundError,
  restoreCloudDocumentVersion,
} from '@/lib/cloud-sync/service'
import { CloudPayloadError, parseRestoreInput, readJsonBody } from '@/lib/cloud-sync/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }
type Context = { params: Promise<{ id: string; versionId: string }> }

export async function POST(request: Request, { params }: Context) {
  try {
    const user = await getCurrentUser()
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401, headers })
    const { baseRevision } = parseRestoreInput(await readJsonBody(request))
    const { id, versionId } = await params
    return Response.json(await restoreCloudDocumentVersion(user.id, id, versionId, baseRevision), { headers })
  } catch (error) {
    if (error instanceof CloudPayloadError) return Response.json({ error: error.message }, { status: 400, headers })
    if (error instanceof CloudDocumentNotFoundError) return Response.json({ error: 'Not found' }, { status: 404, headers })
    if (error instanceof CloudDocumentConflictError) return Response.json(error.details, { status: 409, headers })
    return Response.json({ error: 'Version could not be restored' }, { status: 503, headers })
  }
}
