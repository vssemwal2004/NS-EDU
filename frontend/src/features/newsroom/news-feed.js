import { usableEducationFeed } from '@/lib/education-news';

const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';

// Server-side first paint of /news. On failure the client desk fetches the feed itself.
export async function loadEducationFeed(config) {
  if (!config) return null;
  try {
    const response = await fetch(`${apiUrl}/api/education-news`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    return usableEducationFeed(await response.json(), config);
  } catch (error) {
    console.warn(`[news] feed unavailable: ${error.message}`);
    return null;
  }
}

export function mastheadDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(now);
}
