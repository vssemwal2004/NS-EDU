const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const revalidate = 3600;

// The directory, fee listing, compare, search, apply and account pages need a student session,
// so they are not crawlable and have no sitemap. Admin pages and API responses are not pages, and
// /r/<code> school-drive forms are meant only for students who scan the poster's QR code.
export default function robots() {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/account', '/apply', '/universities', '/colleges', '/compare', '/search', '/login', '/api/', '/r/'],
    }],
    sitemap: [`${siteUrl}/sitemap.xml`],
    host: siteUrl,
  };
}
