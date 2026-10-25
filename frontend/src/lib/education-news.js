// `config` is the admin-edited `news` content entry: topics (ids match the feed classifier) and the cover-image policy.

const sourcePaths = {
  'indianexpress.com': /^\/article\/education\//,
  'www.hindustantimes.com': /^\/education\//,
  'education.economictimes.indiatimes.com': /^\/news\//,
};
const imageHosts = ['images.indianexpress.com', 'www.hindustantimes.com', 'etimg.etb2bimg.com', 'education.economictimes.indiatimes.com'];
export const savedNewsKey = 'nsedu.education.saved.v1';

export function validEducationStory(value, config) {
  if (!value || typeof value.id !== 'string' || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 240 || typeof value.source !== 'string' || value.source.length > 80 || !Number.isFinite(Date.parse(value.publishedAt)) || !['news', 'article'].includes(value.type) || !config.topics.some((topic) => topic.id === value.category)) return false;
  try {
    const url = new URL(value.url);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !!sourcePaths[url.hostname]?.test(url.pathname);
  } catch { return false; }
}

export function safeNewsImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && imageHosts.includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

// ET Education's feed carries only small thumbnails (etimg …/thumb/…). They suit a list row but
// pixelate as a lead photograph, so lead slots prefer publishers that supply full-size images.
export const isThumbnailOnly = (url) => /^https:\/\/etimg\.etb2bimg\.com\/thumb\//.test(String(url ?? ''));

export function displayNewsImage(value, config) {
  const safe = safeNewsImage(value);
  const policy = config.imagePolicy;
  return safe && (policy.mode === 'publisher' || policy.reviewedUrls?.includes(safe)) ? safe : null;
}

export function filterEducationStories(records, { category = 'all', query = '', sort = 'newest', type = 'all' } = {}) {
  const search = query.trim().toLocaleLowerCase();
  return records.filter((record) => (category === 'all' || record.category === category) && (type === 'all' || record.type === type) && (!search || `${record.title} ${record.description || ''} ${record.source}`.toLocaleLowerCase().includes(search))).sort((a, b) => (Date.parse(b.publishedAt) - Date.parse(a.publishedAt)) * (sort === 'oldest' ? -1 : 1));
}

export function newsDate(value, withTime = false) {
  if (!Number.isFinite(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit', hour12: true } : {}), timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

export const SAVED_NEWS_LIMIT = 60;

// A feed payload with only valid stories, or null when the payload is not a usable feed.
export function usableEducationFeed(payload, config) {
  if (!payload || !Array.isArray(payload.articles) || !['ready', 'partial'].includes(payload.status)) return null;
  return { ...payload, articles: payload.articles.filter((record) => validEducationStory(record, config)).map((record) => ({ ...record, imageUrl: safeNewsImage(record.imageUrl) })) };
}

export function readSavedNews(storage, config) {
  try {
    const records = JSON.parse(storage.getItem(savedNewsKey) || '[]');
    return Array.isArray(records) ? records.filter((record) => validEducationStory(record, config)).slice(0, 60).map((record) => ({ ...record, imageUrl: safeNewsImage(record.imageUrl), description: typeof record.description === 'string' ? record.description.slice(0, 180) : '' })) : [];
  } catch { return []; }
}
