import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[autosave] received payload', {
        tabId: payload?.tabId,
        updatedAt: payload?.updatedAt,
      })
    }
    return NextResponse.json({ ok: true, savedAt: Date.now() })
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[autosave] failed to parse payload', error)
    }
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 })
  }
}
