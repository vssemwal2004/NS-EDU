// Routes that need a student session. Shared by proxy.js (optimistic cookie check), the server
// loaders (401 → login) and the client (where to send someone who logs out).
export const STUDENT_COOKIE = 'nsedu_student';
export const DEFAULT_AFTER_LOGIN = '/universities';
export const GATED_PREFIXES = ['/universities', '/colleges', '/compare', '/search', '/apply', '/account'];
export const PATH_HEADER = 'x-gv-path';

export const isGatedPath = (pathname = '') => GATED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

// Only same-origin relative paths survive: "/x?y" yes; "//evil", "/\\evil", "https://…", "/login…" no.
export function safeNext(raw, fallback = DEFAULT_AFTER_LOGIN) {
  const value = String((Array.isArray(raw) ? raw[0] : raw) ?? '').trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || value.length > 512) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'http://gv.local');
    if (url.origin !== 'http://gv.local' || url.pathname === '/login' || url.pathname.startsWith('/login/') || url.pathname.startsWith('/api/')) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

// Which login-popup wording fits a destination (keys of `reasons` in LoginDrawer.js).
export function loginReasonFor(next = '') {
  if (next.startsWith('/apply')) return 'apply';
  if (next.startsWith('/compare')) return 'compare';
  if (next.startsWith('/account')) return 'account';
  return 'directory';
}

export const loginHref = (next) => {
  const target = safeNext(next, '');
  return target ? `/login?next=${encodeURIComponent(target)}` : '/login';
};
