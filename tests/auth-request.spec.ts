/** @jest-environment node */
import { assertAuthMutationRequest, AuthRequestError, readAuthJson } from '@/lib/auth/request'

describe('auth request boundary', () => {
  it('rejects oversized payloads', () => {
    const request = new Request('https://example.test/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '20000', origin: 'https://example.test' } })
    expect(() => assertAuthMutationRequest(request)).toThrow(expect.objectContaining<AuthRequestError>({ status: 413 }))
  })

  it('rejects cross-origin mutations', () => {
    const request = new Request('https://example.test/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' } })
    expect(() => assertAuthMutationRequest(request)).toThrow(expect.objectContaining<AuthRequestError>({ status: 403 }))
  })

  it('rejects a large body even when content-length is absent', async () => {
    const request = new Request('https://example.test/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.test' }, body: JSON.stringify({ value: 'x'.repeat(20_000) }) })
    request.headers.delete('content-length')
    await expect(readAuthJson(request)).rejects.toEqual(expect.objectContaining<AuthRequestError>({ status: 413 }))
  })
})
