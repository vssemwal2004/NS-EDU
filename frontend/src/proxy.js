import { NextResponse } from 'next/server';
import { isGatedPath, isPreviewPath, PATH_HEADER, PREVIEW_COOKIE, STUDENT_COOKIE } from '@/features/auth/gated-routes';

const PREVIEW_MAX_AGE = 30 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (isPreviewPath(pathname)) return previewRoute(request);
  if (!isGatedPath(pathname)) return NextResponse.next();
  const path = `${pathname}${search}`;
  if (!request.cookies.has(STUDENT_COOKIE)) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', path);
    return NextResponse.redirect(login);
  }
  // Server loaders read this to send an expired session back here after logging in again.
  const headers = new globalThis.Headers(request.headers);
  headers.set(PATH_HEADER, path);
  return NextResponse.next({ request: { headers } });
}

// /universities and /search are open with a free preview. A signed-out visitor needs a preview id
// before the page renders: the server-rendered page forwards it to the API, which counts their views
// against it. A page cannot set cookies itself, so this is where the id is issued — on the response
// (for the browser) and on the request (so the very first render already carries it).
function previewRoute(request) {
  const { pathname, search } = request.nextUrl;
  const headers = new globalThis.Headers(request.headers);
  headers.set(PATH_HEADER, `${pathname}${search}`);
  if (request.cookies.has(STUDENT_COOKIE) || UUID.test(request.cookies.get(PREVIEW_COOKIE)?.value ?? '')) return NextResponse.next({ request: { headers } });
  const id = globalThis.crypto.randomUUID();
  headers.set('cookie', [request.headers.get('cookie'), `${PREVIEW_COOKIE}=${id}`].filter(Boolean).join('; '));
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(PREVIEW_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: PREVIEW_MAX_AGE });
  return response;
}

export const config = {
  matcher: [
    '/admin/:path+',
    '/universities/:path*', '/colleges/:path*', '/compare/:path*', '/search/:path*', '/apply/:path*', '/account/:path*',
  ],
};
