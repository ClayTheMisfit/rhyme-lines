import { getCurrentUser } from '@/lib/auth/current-user'
import {
  CloudDocumentConflictError,
  CloudDocumentNotFoundError,
  CloudDocumentTransitionError,
  getCloudDocument,
  transitionCloudDocument,
  updateCloudDocument,
} from '@/lib/cloud-sync/service'
import {
  CloudPayloadError,
  parseCloudDocumentUpdateInput,
  parseLifecycleInput,
  readJsonBody,
} from '@/lib/cloud-sync/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }
type Context = { params: Promise<{ id: string }> }

const handleError = (error: unknown) => {
  if (error instanceof CloudPayloadError) return Response.json({ error: error.message }, { status: 400, headers })
  if (error instanceof CloudDocumentNotFoundError) return Response.json({ error: 'Not found' }, { status: 404, headers })
  if (error instanceof CloudDocumentConflictError) return Response.json(error.details, { status: 409, headers })
  if (error instanceof CloudDocumentTransitionError) {
    return Response.json({ error: 'Lifecycle transition is not allowed' }, { status: 409, headers })
  }
  return Response.json({ error: 'Cloud document operation failed' }, { status: 503, headers })
}

async function ownedUser() {
  const user = await getCurrentUser()
  return user?.id ?? null
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const userId = await ownedUser()
    if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401, headers })
    const { id } = await params
    return Response.json({ document: await getCloudDocument(userId, id) }, { headers })
  } catch (error) {
    return handleError(error)
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const userId = await ownedUser()
    if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401, headers })
    const input = parseCloudDocumentUpdateInput(await readJsonBody(request))
    const { id } = await params
    return Response.json({ document: await updateCloudDocument(userId, id, input) }, { headers })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const userId = await ownedUser()
    if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401, headers })
    const input = parseLifecycleInput(await readJsonBody(request))
    const { id } = await params
    return Response.json({ document: await transitionCloudDocument(userId, id, input.action, input.baseRevision) }, { headers })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const userId = await ownedUser()
    if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401, headers })
    const input = parseLifecycleInput({ ...(await readJsonBody(request) as object), action: 'delete-permanently' })
    const { id } = await context.params
    return Response.json({ document: await transitionCloudDocument(userId, id, input.action, input.baseRevision) }, { headers })
  } catch (error) {
    return handleError(error)
  }
}
