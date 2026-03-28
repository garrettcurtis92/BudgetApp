import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for any Supabase auth cookie (named sb-[project-ref]-auth-token or chunked)
  const hasSession = request.cookies.getAll().some(c => c.name.startsWith('sb-'))

  if (!hasSession && pathname !== '/') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (hasSession && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-192.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
