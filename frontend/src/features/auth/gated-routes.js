// Routes that need a student session. Shared by proxy.js (optimistic cookie check), the server
// loaders (401 → login) and the client (where to send someone who logs out).
export const STUDENT_COOKIE = 'nsedu_student';
export const DEFAULT_AFTER_LOGIN = '/universities';
// /universities and /search are not here: signed-out visitors get a free preview of them (the API
// counts it, see backend universities/free-preview.js) and are asked to log in once it is used up.
export const GATED_PREFIXES = ['/colleges', '/compare', '/apply', '/account'];
// Routes that carry the free preview. The proxy gives a signed-out visitor their preview cookie here.
export const PREVIEW_PREFIXES = ['/universities', '/search'];
export const PREVIEW_COOKIE = 'gv_preview';
export const PATH_HEADER = 'x-gv-path';

const under = (prefixes, pathname) => prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
export const isGatedPath = (pathname = '') => under(GATED_PREFIXES, pathname);
export const isPreviewPath = (pathname = '') => under(PREVIEW_PREFIXES, pathname);

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
export function loginReasonFor(next = '', why = '') {
  if (why === 'limit') return 'limit';
  if (next.startsWith('/apply')) return 'apply';
  if (next.startsWith('/compare')) return 'compare';
  if (next.startsWith('/account')) return 'account';
  return 'directory';
}

// `why` = 'limit' says the free university views are used up, so the popup explains that.
export const loginHref = (next, why = '') => {
  const target = safeNext(next, '');
  if (!target) return '/login';
  return `/login?next=${encodeURIComponent(target)}${why === 'limit' ? '&why=limit' : ''}`;
};
