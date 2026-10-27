import { cache } from 'react';

// Server-side loader for a public school drive form (GET /api/forms/:code). Never cached: every page
// view needs a fresh form token, and closing a drive must show at once.
const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';
export const CODE_PATTERN = /^[a-hjkmnp-z2-9]{8}$/i;

/** → { status: 'open', form, token } | { status: 'closed', school } | { status: 'missing' } | { status: 'error' } */
export const loadRegistrationForm = cache(async (code) => {
  if (!CODE_PATTERN.test(code)) return { status: 'missing' };
  try {
    const response = await fetch(`${apiUrl}/api/forms/${code.toLowerCase()}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    const data = await response.json().catch(() => null);
    if (response.status === 404) return { status: 'missing' };
    if (response.status === 410) return { status: 'closed', school: data?.school ?? null };
    if (!response.ok || !data?.form) throw new Error(`responded ${response.status}`);
    return { status: 'open', form: data.form, token: data.token };
  } catch (error) {
    console.warn(`[registration] form ${code} unavailable: ${error.message}`);
    return { status: 'error' };
  }
});
