import { getCurrentUser } from '@/lib/auth/current-user'
import { CloudDocumentConflictError, CloudDocumentNotFoundError, resolveKeepLocal } from '@/lib/cloud-sync/service'
import { CloudPayloadError, parseCloudDocumentUpdateInput, readJsonBody } from '@/lib/cloud-sync/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401, headers })
    const body = await readJsonBody(request)
    if (!body || typeof body !== 'object' || !('intent' in body) || body.intent !== 'keep-local') {
      throw new CloudPayloadError('Resolution intent is invalid')
    }
    const input = parseCloudDocumentUpdateInput(body)
    const { id } = await params
    return Response.json({ document: await resolveKeepLocal(user.id, id, input) }, { headers })
  } catch (error) {
    if (error instanceof CloudPayloadError) return Response.json({ error: error.message }, { status: 400, headers })
    if (error instanceof CloudDocumentNotFoundError) return Response.json({ error: 'Not found' }, { status: 404, headers })
    if (error instanceof CloudDocumentConflictError) return Response.json(error.details, { status: 409, headers })
    return Response.json({ error: 'Conflict resolution failed' }, { status: 503, headers })
  }
}
