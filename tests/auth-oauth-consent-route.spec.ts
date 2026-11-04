/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('@/lib/auth/environment', () => ({ getAuthEnvironment: () => ({ secret: 'a sufficiently long authentication secret' }) }))

import { POST } from '@/app/api/auth/oauth-consent/route'

function request(headers: Record<string, string>, body = JSON.stringify({ acceptedTerms: true })) {
  return new Request('https://example.test/api/auth/oauth-consent', { method: 'POST', headers, body })
}

describe('OAuth consent route', () => {
  it('rejects cross-origin requests without issuing a cookie', async () => {
    const response = await POST(request({ 'content-type': 'application/json', origin: 'https://evil.example' }))
    expect(response.status).toBe(403)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('rejects non-JSON form submissions without issuing a cookie', async () => {
    const response = await POST(request({ 'content-type': 'text/plain', origin: 'https://example.test' }, '{"acceptedTerms":true,"padding":"="}'))
    expect(response.status).toBe(415)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('issues the short-lived HTTP-only cookie for same-origin JSON acknowledgement', async () => {
    const response = await POST(request({ 'content-type': 'application/json', origin: 'https://example.test' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toMatch(/rhyme-lines-oauth-consent=.*HttpOnly.*SameSite=Lax/i)
  })
})
