// /universities/sitemap/<n>.xml — one file per 10,000 university profiles, refreshed hourly.
const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const revalidate = 3600;

async function page(id) {
  const response = await fetch(`${apiUrl}/api/universities/sitemap?page=${id}`, { next: { revalidate }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Sitemap page ${id} responded ${response.status}`);
  return response.json();
}

export async function generateSitemaps() {
  try {
    const { pages } = await page(0);
    return Array.from({ length: Math.max(1, pages) }, (_, id) => ({ id: String(id) }));
  } catch {
    return [{ id: '0' }];
  }
}

export default async function sitemap({ id }) {
  const { items } = await page(Number(await id) || 0);
  return items.map((item) => ({ url: `${siteUrl}/universities/${item.id}`, lastModified: item.updatedAt ? new Date(item.updatedAt) : undefined, changeFrequency: 'weekly', priority: 0.7 }));
}
