// "Continue with Google" is a full-page redirect through the API (/api/auth/google/start →
// Google → /api/auth/google/callback), so no Google script ever runs on our pages. The API
// re-validates returnTo; this only keeps the URL tidy.
export function googleStartHref(returnTo, { link = false } = {}) {
  const params = new URLSearchParams({ returnTo: returnTo || '/account' });
  if (link) params.set('link', '1');
  return `/api/auth/google/start?${params}`;
}

// Where to come back to: this page, minus the one-shot flags (?error, ?linked, ?welcome) from a previous try.
export function currentReturnTo() {
  const url = new URL(window.location.href);
  for (const flag of ['error', 'linked', 'welcome']) url.searchParams.delete(flag);
  return `${url.pathname}${url.search}`;
}

// Codes sent back by the API as ?error=<code> (see student-auth.routes.js).
const MESSAGES = {
  cancelled: 'Google sign-in was cancelled. Try again, or use a one-time code instead.',
  state: 'That Google sign-in expired or was started in another tab. Please try again.',
  'google-unavailable': 'We couldn’t complete sign-in with Google just now. Try again, or use a one-time code.',
  'email-unverified': 'Your Google account’s email address isn’t verified with Google. Use a one-time code instead.',
  blocked: 'This account is suspended. Please contact support.',
  'google-in-use': 'That Google account is already connected to a different Gyaan Vidhya account. Log in with an email or mobile code instead.',
  'google-other': 'Your account is already connected to a different Google account.',
  busy: 'Too many Google sign-ins from this network just now. Wait a few minutes, or use a one-time code.',
};
export const googleErrorMessage = (code) => (typeof code === 'string' && Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : '');

// Linking runs from /account, where the same codes read slightly differently.
const LINK_MESSAGES = {
  ...MESSAGES,
  'google-in-use': 'That Google account, or its email address, already belongs to another Gyaan Vidhya account, so it can’t be connected here.',
  cancelled: 'Connecting Google was cancelled. Nothing changed.',
};
export const googleLinkErrorMessage = (code) => (typeof code === 'string' && Object.hasOwn(LINK_MESSAGES, code) ? LINK_MESSAGES[code] : '');
