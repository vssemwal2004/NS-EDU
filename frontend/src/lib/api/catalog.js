import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { redirectToLogin, studentCookieHeader } from './session';

// Server-side catalog loader. MongoDB (through Express) is the only source: when the API cannot be
// reached each list is empty and `live` is false, so pages render an unavailable state (no bundled data).
const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';

class Unauthorized extends Error {}

async function getJson(path, { student = false, timeout = 4000 } = {}) {
  const cookie = student ? await studentCookieHeader() : '';
  const response = await fetch(`${apiUrl}/api${path}`, { cache: 'no-store', headers: cookie ? { cookie } : {}, signal: AbortSignal.timeout(timeout) });
  if (response.status === 401 && student) throw new Unauthorized(path);
  if (!response.ok) throw new Error(`${path} responded ${response.status}`);
  return response.json();
}

// University data needs a student session: a 401 sends the visitor to /login?next=<this page>.
// redirect() throws, so it runs outside every try/catch.
async function studentJson(path, fallback, options) {
  try {
    return await getJson(path, { ...options, student: true });
  } catch (error) {
    unstable_rethrow(error);
    if (!(error instanceof Unauthorized)) return fallback(error);
  }
  await redirectToLogin();
}

async function load(path, pick, fallback) {
  try {
    return { value: pick(await getJson(path)), live: true };
  } catch (error) {
    console.warn(`[catalog] ${path} unavailable: ${error.message}`);
    return { value: fallback, live: false };
  }
}

// Deduplicated per request, so the layout and a page can both read the catalog.
export const getCatalog = cache(async function getCatalog() {
  const [courses, exams, colleges, locations, scholarships, stats] = await Promise.all([
    load('/catalog/courses', (data) => data.items, []),
    load('/catalog/exams', (data) => data.items, []),
    load('/catalog/colleges', (data) => data.items, []),
    load('/catalog/locations', (data) => data, { cities: [], states: [], totals: { cities: 0, states: 0 } }),
    load('/catalog/scholarships', (data) => data.items, []),
    load('/platform/stats', (data) => data, null),
  ]);
  return {
    courses: courses.value,
    exams: exams.value,
    colleges: colleges.value,
    cities: locations.value.cities,
    states: locations.value.states,
    // Every city/state the 9k-record directory covers, not just the curated destination tiles.
    locationTotals: locations.value.totals ?? { cities: 0, states: 0 },
    scholarships: scholarships.value,
    stats: stats.value,
    live: [courses, exams, colleges, locations, scholarships].every((item) => item.live),
  };
});

// Where one course is taught and the fees institutions publish for it. The counts and fee spread are
// public; the named institutions come back only with a student session (requiresLogin otherwise).
// null when the API is unreachable, so the page can still render the course itself.
export const getCourseOfferings = cache(async function getCourseOfferings(slug, query = '') {
  try {
    return await getJson(`/catalog/courses/${encodeURIComponent(slug)}/offerings${query ? `?${query}` : ''}`, { student: true, timeout: 6000 });
  } catch (error) {
    unstable_rethrow(error);
    console.warn(`[catalog] Offerings for ${slug} unavailable: ${error.message}`);
    return null;
  }
});

// University directory (20k+ records): always paginated and filtered on the server.
export const UNIVERSITY_QUERY_KEYS = ['q', 'state', 'city', 'type', 'category', 'ownership', 'stream', 'course', 'naac', 'sort', 'page'];

export function universityQuery(params = {}) {
  const query = new URLSearchParams();
  for (const key of UNIVERSITY_QUERY_KEYS) {
    const value = String((Array.isArray(params[key]) ? params[key][0] : params[key]) ?? '').trim().slice(0, 120);
    if (value && !(key === 'page' && value === '1') && !(key === 'sort' && value === 'relevance')) query.set(key, value);
  }
  return query.toString();
}

export const getUniversities = cache(async function getUniversities(query) {
  const data = await studentJson(`/universities?${query}&limit=24`, (error) => {
    console.warn(`[catalog] University search failed: ${error.message}`);
    return null;
  });
  return data ? { ...data, failed: false } : { items: [], total: 0, page: 1, pages: 1, failed: true };
});

export const getUniversityFacets = cache(async function getUniversityFacets(state = '') {
  return studentJson(`/universities/facets${state ? `?state=${encodeURIComponent(state)}` : ''}`,
    () => ({ total: 0, states: [], types: [], categories: [], ownership: [], naac: [], streams: [], cities: [] }));
});

// null means "no such university" (404); other failures throw so the error boundary can show a retry.
export const getUniversity = cache(async function getUniversity(slug) {
  return studentJson(`/universities/${encodeURIComponent(slug)}`, (error) => {
    if (/responded 404$/.test(error.message)) return null;
    throw new Error(`University ${slug} unavailable: ${error.message}`);
  }, { timeout: 6000 });
});

// Public: the small curated set shown on the landing page to logged-out visitors. Cached for 5 minutes.
export const getFeaturedUniversities = cache(async function getFeaturedUniversities(limit = 8) {
  try {
    const response = await fetch(`${apiUrl}/api/universities/featured?limit=${Number(limit) || 8}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`responded ${response.status}`);
    return { items: (await response.json()).items ?? [], failed: false };
  } catch (error) {
    console.warn(`[catalog] Featured universities unavailable: ${error.message}`);
    return { items: [], failed: true };
  }
});

// Colleges in the results need a session: signed out, the API returns colleges: [] and collegesRequireLogin: true.
export async function searchCatalog(query) {
  const empty = { query, courses: [], exams: [], colleges: [], collegesRequireLogin: false };
  if (!query) return { results: empty, failed: false };
  try {
    return { results: { ...empty, ...await getJson(`/catalog/search?q=${encodeURIComponent(query)}`, { student: true }) }, failed: false };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Unauthorized) return { results: { ...empty, collegesRequireLogin: true }, failed: false };
    console.warn(`[catalog] Search failed: ${error.message}`);
    return { results: empty, failed: true };
  }
}
