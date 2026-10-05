import { AUTH_PAYLOAD_LIMIT } from './validation'

export class AuthRequestError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function assertAuthMutationRequest(request: Request) {
  const type = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (type !== 'application/json') throw new AuthRequestError(415, 'Use application/json.')
  const length = Number(request.headers.get('content-length') || '0')
  if (Number.isFinite(length) && length > AUTH_PAYLOAD_LIMIT) throw new AuthRequestError(413, 'Request is too large.')
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) throw new AuthRequestError(403, 'Request origin is not allowed.')
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) throw new AuthRequestError(403, 'Request origin is not allowed.')
}

export async function readBodyWithinLimit(request: Request, limit = AUTH_PAYLOAD_LIMIT) {
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > limit) {
      try { await reader.cancel() } catch { /* The size decision is already final. */ }
      throw new AuthRequestError(413, 'Request is too large.')
    }
    chunks.push(value)
  }
  const body = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

export async function readAuthJson(request: Request) {
  assertAuthMutationRequest(request)
  const body = await readBodyWithinLimit(request)
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)) as unknown } catch { throw new AuthRequestError(400, 'Request body is invalid.') }
}
