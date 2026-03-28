import { NextResponse, type NextRequest } from 'next/server'

// Auth is handled at the layout level via Supabase server client.
// Proxy only passes requests through.
export function proxy(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-192.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
