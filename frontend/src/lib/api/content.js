import { cache } from 'react';

// Server-side loader for admin-editable site content (GET /api/content?keys=...).
// There are no bundled copies: when the API is unreachable every requested key is null
// and the UI renders its "temporarily unavailable" state instead.
const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';

// Keyed by the sorted key list (a string), so React's per-request cache can deduplicate it.
const load = cache(async function loadContent(list) {
  try {
    const response = await fetch(`${apiUrl}/api/content?keys=${list}`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`responded ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`[content] ${list} unavailable: ${error.message}`);
    return {};
  }
});

export async function getContent(keys) {
  const data = await load([...new Set(keys)].sort().join(','));
  return Object.fromEntries(keys.map((key) => [key, data[key] ?? null]));
}

// Keys the shared chrome needs on every public page (footer, artwork); one request per render.
export const getSharedContent = () => getContent(['media', 'site']);
