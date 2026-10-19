const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const revalidate = 3600;

// Login-gated routes (/universities, /colleges, /compare, /search, /apply, /account) are left out.
const STATIC_ROUTES = ['', '/courses', '/exams', '/locations', '/eligibility', '/budget', '/scholarships', '/career-guidance', '/admission-checklist', '/news', '/about', '/contact', '/help', '/sources-and-editorial', '/accessibility'];

async function catalogIds(path) {
  try {
    const response = await fetch(`${apiUrl}/api/catalog/${path}`, { next: { revalidate }, signal: AbortSignal.timeout(10_000) });
    return response.ok ? (await response.json()).items.map((item) => item.id) : [];
  } catch {
    return [];
  }
}

// Core public pages plus course and exam guides. University profiles are login-gated and not listed.
export default async function sitemap() {
  const [courses, exams] = await Promise.all([catalogIds('courses'), catalogIds('exams')]);
  return [
    ...STATIC_ROUTES.map((route) => ({ url: `${siteUrl}${route}`, changeFrequency: route ? 'weekly' : 'daily', priority: route ? 0.6 : 1 })),
    ...courses.map((id) => ({ url: `${siteUrl}/courses/${id}`, changeFrequency: 'monthly', priority: 0.5 })),
    ...exams.map((id) => ({ url: `${siteUrl}/exams/${id}`, changeFrequency: 'monthly', priority: 0.5 })),
  ];
}
