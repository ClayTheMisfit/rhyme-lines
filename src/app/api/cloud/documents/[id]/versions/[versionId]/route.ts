import { getCurrentUser } from '@/lib/auth/current-user'
import { CloudDocumentNotFoundError, getCloudDocumentVersion } from '@/lib/cloud-sync/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }
type Context = { params: Promise<{ id: string; versionId: string }> }

export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await getCurrentUser()
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401, headers })
    const { id, versionId } = await params
    return Response.json({ version: await getCloudDocumentVersion(user.id, id, versionId) }, { headers })
  } catch (error) {
    if (error instanceof CloudDocumentNotFoundError) return Response.json({ error: 'Not found' }, { status: 404, headers })
    return Response.json({ error: 'Version could not be loaded' }, { status: 503, headers })
  }
}
