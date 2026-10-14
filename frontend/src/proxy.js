import { NextResponse } from 'next/server';

// Optimistic guard only: send visitors without an admin session cookie to the admin login.
// Express verifies the JWT on every /api/admin request, which is the real authorization check.
export function proxy(request) {
  if (request.cookies.has('nsedu_admin')) return NextResponse.next();
  const login = new URL('/admin', request.url);
  login.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ['/admin/:path+'] };
