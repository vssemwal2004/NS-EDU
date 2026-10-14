import { cache } from 'react';
import { courses as fallbackCourses, exams as fallbackExams, cities as fallbackCityNames } from '@/data/landing';
import { staticCollegeRecords } from '@/data/colleges';
import { studyCities, studyStates, stateNames } from '@/data/destinations';
import { scholarshipResources } from '@/data/budget';

// Server-side catalog loader. MongoDB (through Express) is the source of truth;
// the bundled seed files are only used when the API cannot be reached, so the
// public site keeps working during a backend outage.
const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';

async function getJson(path) {
  const response = await fetch(`${apiUrl}/api${path}`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`${path} responded ${response.status}`);
  return response.json();
}

async function load(path, pick, fallback) {
  try {
    return { value: pick(await getJson(path)), live: true };
  } catch (error) {
    console.warn(`[catalog] Using bundled seed data for ${path}: ${error.message}`);
    return { value: fallback, live: false };
  }
}

function withArtwork(names, featured) {
  return names.map((name) => {
    const tile = featured.find((item) => item.name === name);
    return { name, landmark: tile?.landmark || '', crop: tile?.crop || null, featured: Boolean(tile) };
  });
}
const fallbackLocations = { cities: withArtwork(fallbackCityNames, studyCities), states: withArtwork(stateNames, studyStates) };

// Deduplicated per request, so the layout and a page can both read the catalog.
export const getCatalog = cache(async function getCatalog() {
  const [courses, exams, colleges, locations, scholarships] = await Promise.all([
    load('/catalog/courses', (data) => data.items, fallbackCourses.map((course, index) => ({ ...course, popular: index < 6 }))),
    load('/catalog/exams', (data) => data.items, fallbackExams),
    load('/catalog/colleges', (data) => data.items, staticCollegeRecords),
    load('/catalog/locations', (data) => data, fallbackLocations),
    load('/catalog/scholarships', (data) => data.items, scholarshipResources.map((item) => ({ ...item, id: item.href }))),
  ]);
  return {
    courses: courses.value,
    exams: exams.value,
    colleges: colleges.value,
    cities: locations.value.cities,
    states: locations.value.states,
    scholarships: scholarships.value,
    live: [courses, exams, colleges, locations, scholarships].every((item) => item.live),
  };
});

export async function searchCatalog(query) {
  const empty = { query, courses: [], exams: [], colleges: [] };
  if (!query) return { results: empty, failed: false };
  try {
    return { results: await getJson(`/catalog/search?q=${encodeURIComponent(query)}`), failed: false };
  } catch (error) {
    console.warn(`[catalog] Search failed: ${error.message}`);
    return { results: empty, failed: true };
  }
}
