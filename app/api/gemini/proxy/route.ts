import { NextRequest, NextResponse } from 'next/server'

// Server-only secret for internal calls
const SECRET_HASH = '85ee0a054f8f053342b0b9131026b455'
const SESSION_COOKIE = 'cg_session'

export async function POST(request: NextRequest) {
  try {
    // 1) Same-origin check using Origin/Referer
    const requestOrigin = new URL(request.url).origin
    const originHeader = request.headers.get('origin')
    const refererHeader = request.headers.get('referer')
    const headerOrigin = originHeader || (refererHeader ? new URL(refererHeader).origin : null)

    if (!headerOrigin || headerOrigin !== requestOrigin) {
      return NextResponse.json({ error: 'Forbidden (origin mismatch)' }, { status: 403 })
    }

    // 2) Require our session cookie (HttpOnly set by middleware)
    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value
    if (!sessionCookie || sessionCookie !== 'ok') {
      return NextResponse.json({ error: 'Unauthorized (missing session)' }, { status: 401 })
    }

    // 3) Content-Type guard
    if (request.headers.get('content-type') !== 'application/json') {
      return NextResponse.json({ error: 'Unsupported Media Type' }, { status: 415 })
    }

    // Read the original payload from the client (no secret expected here)
    const body = await request.json()

    // Forward request to the internal generate endpoint with the server-only header
    const internalUrl = new URL('/api/gemini/generate', request.url)

    const res = await fetch(internalUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-auth': SECRET_HASH,
      },
      body: JSON.stringify(body),
      // Ensure this is treated as an internal/server fetch and not cached
      cache: 'no-store',
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json({ success: false, error: 'Proxy failure' }, { status: 500 })
  }
}
