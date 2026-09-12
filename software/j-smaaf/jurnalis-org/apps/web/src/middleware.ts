import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Cek EKSISTENSI cookie access_token saja (verifikasi JWT tetap di backend)
const PROTECTED_PREFIXES = [
  '/dashboard', '/tasks', '/projects', '/schedule', '/content', '/editorial',
  '/finance', '/pitches', '/assets', '/performance', '/analytics', '/storage',
  '/users', '/profile', '/settings', '/sop/manage', '/alumni/profile',
]

export function middleware(request: NextRequest) {
  const hasToken = request.cookies.has('access_token')
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (isProtected && !hasToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if ((pathname === '/login' || pathname === '/register') && hasToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*', '/tasks/:path*', '/projects/:path*', '/schedule/:path*',
    '/content/:path*', '/editorial/:path*', '/finance/:path*', '/pitches/:path*',
    '/assets/:path*', '/performance/:path*', '/analytics/:path*', '/storage/:path*',
    '/users/:path*', '/profile/:path*', '/settings/:path*', '/sop/manage',
    '/alumni/profile', '/login', '/register',
  ],
}
