// Wraps case-insensitive matches of the query in <mark>. Regex specials in the query are escaped.
export function highlight(text, query) {
  if (!text || !query) return text;
  const pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return String(text).split(pattern).map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part));
}

export const normalize = (value) => String(value || '').toLowerCase().replace(/[\s.\-_]/g, '');
