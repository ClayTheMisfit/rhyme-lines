import { getCurrentUser } from '@/lib/auth/current-user'
import { createCloudDocument, listCloudDocuments } from '@/lib/cloud-sync/service'
import { CloudPayloadError, parseCloudDocumentInput, readJsonBody } from '@/lib/cloud-sync/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401, headers })
    return Response.json(await listCloudDocuments(user.id), { headers })
  } catch {
    return Response.json({ error: 'Cloud documents are temporarily unavailable' }, { status: 503, headers })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401, headers })
    const input = parseCloudDocumentInput(await readJsonBody(request))
    return Response.json({ document: await createCloudDocument(user.id, input) }, { status: 201, headers })
  } catch (error) {
    if (error instanceof CloudPayloadError) {
      return Response.json({ error: error.message }, { status: 400, headers })
    }
    return Response.json({ error: 'Cloud document could not be created' }, { status: 503, headers })
  }
}
