import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { loginHref, PATH_HEADER, PREVIEW_COOKIE, STUDENT_COOKIE } from '@/features/auth/gated-routes';

// Server-only helpers for the student session. The API owns the real check; these forward the
// browser's session cookie to it and turn a 401 into a trip to /login?next=<this page>.
const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';

export async function studentCookieHeader() {
  const value = (await cookies()).get(STUDENT_COOKIE)?.value;
  return value ? `${STUDENT_COOKIE}=${value}` : '';
}

// The cookies the API reads for a university request: the session and, for a signed-out visitor,
// the preview id that their free views are counted against.
export async function directoryCookieHeader() {
  const store = await cookies();
  return [STUDENT_COOKIE, PREVIEW_COOKIE].map((name) => store.get(name)).filter(Boolean).map(({ name, value }) => `${name}=${value}`).join('; ');
}

// Path + query of the current request, set by proxy.js on gated routes.
export async function currentPath() {
  return (await headers()).get(PATH_HEADER) || '';
}

// `why` = 'limit' when the free university views are used up (shown in the login popup).
export async function redirectToLogin(nextPath, why = '') {
  redirect(loginHref(nextPath ?? await currentPath(), why));
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
