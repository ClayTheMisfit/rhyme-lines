/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('server-only', () => ({}))
jest.mock('@/auth', () => ({
  handlers: {
    GET: jest.fn(async () => new Response(null, { status: 204 })),
    POST: jest.fn(async () => new Response(null, { status: 204 })),
  },
}))

import { handlers } from '@/auth'
import { POST } from '@/app/api/auth/[...nextauth]/route'

describe('Auth.js route boundary', () => {
  it('rejects an oversized body even when content-length is absent', async () => {
    const request = new NextRequest('https://example.test/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `value=${'x'.repeat(70_000)}`,
    })
    request.headers.delete('content-length')
    const response = await POST(request)
    expect(response.status).toBe(413)
    expect(handlers.POST).not.toHaveBeenCalled()
  })
})
