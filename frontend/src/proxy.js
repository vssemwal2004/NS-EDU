import { NextResponse } from 'next/server';
import { isGatedPath, PATH_HEADER, STUDENT_COOKIE } from '@/features/auth/gated-routes';

// Optimistic guards only: a missing session cookie goes straight to the matching login.
// Express verifies the JWT on every protected API request, which is the real authorization check.
export function proxy(request) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith('/admin/')) {
    if (request.cookies.has('nsedu_admin')) return NextResponse.next();
    const login = new URL('/admin', request.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }
  if (!isGatedPath(pathname)) return NextResponse.next();
  const path = `${pathname}${search}`;
  if (!request.cookies.has(STUDENT_COOKIE)) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', path);
    return NextResponse.redirect(login);
  }
  // Server loaders read this to send an expired session back here after logging in again.
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, path);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    '/admin/:path+',
    '/universities/:path*', '/colleges/:path*', '/compare/:path*', '/search/:path*', '/apply/:path*', '/account/:path*',
  ],
};
