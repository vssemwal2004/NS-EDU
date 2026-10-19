// Every directory view is a URL: filters, sort and page live in the query string (server-rendered,
// shareable, back-button friendly). Shared by server and client components.
export const DIRECTORY_PATH = '/universities';
export const FILTER_KEYS = ['state', 'city', 'type', 'category', 'ownership', 'stream', 'course', 'naac'];

export function directoryHref(params, patch = {}) {
  const next = { ...params, ...patch };
  if (!('page' in patch)) delete next.page;
  if (patch.state !== undefined && patch.state !== params.state) delete next.city;
  const query = new URLSearchParams(Object.entries(next).filter(([key, value]) => value && !(key === 'sort' && value === 'relevance') && !(key === 'page' && String(value) === '1')));
  const text = query.toString();
  return text ? `${DIRECTORY_PATH}?${text}` : DIRECTORY_PATH;
}

export const clearedFilters = () => Object.fromEntries(['q', ...FILTER_KEYS].map((key) => [key, '']));

// 1 … 4 5 [6] 7 8 … 20 — null marks a gap.
export function pageWindow(page, pages) {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= pages));
  if (page <= 3) [2, 3, 4].forEach((value) => value <= pages && wanted.add(value));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((value) => value >= 1 && wanted.add(value));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((value, index) => (index && value - sorted[index - 1] > 1 ? [null, value] : [value]));
}
