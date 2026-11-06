import { listColleges, listCourses, listExams, listLocations, listScholarships, platformStats } from './modules/catalog/catalog-service.js';
import { getContentEntries } from './modules/content/content-service.js';
import { CONTENT_KEYS } from './modules/content/registry.js';
import { featuredUniversities, listUniversities, universityFacets } from './modules/universities/university-service.js';
import { getEducationNews } from './services/education-news.js';

/**
 * Keeps the data every visitor needs (catalogue, homepage figures, site content, the first directory
 * page and its filters) loaded in this process, so no visitor ever waits on the database for it.
 * The caches serve stale entries while they refresh (ttl-cache staleMs), and this call refreshes
 * them on a timer — in practice the shared pages are answered from memory in a few milliseconds.
 */
const EVERY_MS = 4 * 60_000;

export async function warmPublicData() {
  const started = performance.now();
  const results = await Promise.allSettled([
    listCourses(), listExams(), listColleges(), listLocations(), listScholarships(), platformStats(),
    getContentEntries(Object.keys(CONTENT_KEYS)),
    featuredUniversities(8), universityFacets({}), listUniversities({}),
    // Publisher feeds: fetched here so the news page never waits on them (the service has its own cache).
    getEducationNews(),
  ]);
  const failed = results.filter((result) => result.status === 'rejected').length;
  return { ms: Math.round(performance.now() - started), failed };
}

export function keepPublicDataWarm() {
  const timer = setInterval(() => { warmPublicData().catch(() => {}); }, EVERY_MS);
  timer.unref(); // never keeps the process alive on its own
  return timer;
}
