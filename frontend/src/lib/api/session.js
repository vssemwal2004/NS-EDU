import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { loginHref, PATH_HEADER, STUDENT_COOKIE } from '@/features/auth/gated-routes';

// Server-only helpers for the student session. The API owns the real check; these forward the
// browser's session cookie to it and turn a 401 into a trip to /login?next=<this page>.
const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';

export async function studentCookieHeader() {
  const value = (await cookies()).get(STUDENT_COOKIE)?.value;
  return value ? `${STUDENT_COOKIE}=${value}` : '';
}

// Path + query of the current request, set by proxy.js on gated routes.
export async function currentPath() {
  return (await headers()).get(PATH_HEADER) || '';
}

export async function redirectToLogin(nextPath) {
  redirect(loginHref(nextPath ?? await currentPath()));
}

// { student, signedOut }: signedOut is true only when the API said so (or there is no cookie),
// so an unreachable API never logs anyone out.
const loadSession = cache(async function loadSession() {
  const cookie = await studentCookieHeader();
  if (!cookie) return { student: null, signedOut: true };
  try {
    const response = await fetch(`${apiUrl}/api/auth/me`, { headers: { cookie }, cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (response.status === 401) return { student: null, signedOut: true };
    return { student: response.ok ? (await response.json()).student : null, signedOut: false };
  } catch (error) {
    unstable_rethrow(error);
    return { student: null, signedOut: false };
  }
});

/** The signed-in student ({ id, email, phone, name }) or null. Deduplicated per request. */
export async function getStudentSession() {
  return (await loadSession()).student;
}

/** Call at the top of a gated page: returns the student (null if the API is unreachable) or redirects to /login?next=… */
export async function requireStudentSession(nextPath) {
  const { student, signedOut } = await loadSession();
  if (signedOut) await redirectToLogin(nextPath);
  return student;
}
