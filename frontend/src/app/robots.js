const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const revalidate = 3600;

// Admin, account and application pages are private; API responses are not pages.
export default async function robots() {
  let pages = 1;
  try {
    const response = await fetch(`${apiUrl}/api/universities/sitemap?page=0`, { next: { revalidate }, signal: AbortSignal.timeout(10_000) });
    if (response.ok) pages = Math.max(1, (await response.json()).pages);
  } catch { /* keep one sitemap file */ }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/apply', '/api/'] }],
    sitemap: [`${siteUrl}/sitemap.xml`, ...Array.from({ length: pages }, (_, id) => `${siteUrl}/universities/sitemap/${id}.xml`)],
    host: siteUrl,
  };
}
