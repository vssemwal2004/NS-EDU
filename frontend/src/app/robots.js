const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const revalidate = 3600;

// The directory, fee listing, compare, search, apply and account pages need a student session,
// so they are not crawlable and have no sitemap. Admin pages and API responses are not pages.
export default function robots() {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/account', '/apply', '/universities', '/colleges', '/compare', '/search', '/login', '/api/'],
    }],
    sitemap: [`${siteUrl}/sitemap.xml`],
    host: siteUrl,
  };
}
