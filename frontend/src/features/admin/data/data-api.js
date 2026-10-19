import { ApiError } from '@/lib/api/client';

const BASE = '/api/admin/data-ops';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Files go up as raw text (not JSON) so large lists bypass the API's 100 kB JSON limit.
export async function uploadText(path, text, params = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'text/plain; charset=utf-8' }, body: text,
    });
  } catch {
    throw new ApiError('Unable to reach Gyaan Vidhya. Check your connection and try again.', 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.error || 'The upload could not be completed.', response.status, data?.fields || null, data || {});
  return data;
}

export const exportUrl = (params = {}) => `${BASE}/universities/export.csv?${new URLSearchParams(params)}`;
export const TEMPLATE_URL = `${BASE}/universities/template.csv`;

export function formatOf(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) return 'csv';
  return '';
}

const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export const formatDate = (value) => (value ? dateTime.format(new Date(value)) : '—');
export const formatCount = (value) => Number(value ?? 0).toLocaleString('en-IN');
export const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url || ''; }
};
