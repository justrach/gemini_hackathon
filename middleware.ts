import { NextRequest, NextResponse } from 'next/server'

// Session cookie used by the internal proxy guard
const SESSION_COOKIE = 'cg_session'

export function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl

  // Only set session for same-site document/app requests, not for external origins
  // Skip API routes; cookie will automatically be sent on same-site fetches
  const isApiRoute = pathname.startsWith('/api/')

  // If cookie already present or it's an API route, just continue
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value
  if (hasSession || isApiRoute) {
    return NextResponse.next()
  }

  // Set a minimal HttpOnly, SameSite=Strict session cookie for CSRF-style guard
  const res = NextResponse.next()
  res.cookies.set({
    name: SESSION_COOKIE,
    value: 'ok',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
  return res
}

export const config = {
  // Run on all pages and static assets, but not on Next internal assets
  matcher: ['/((?!_next/|static/).*)'],
}
