import RecommendedUniversities from '@/features/recommendations/RecommendedUniversities';
import TrackEvent from '@/features/recommendations/TrackEvent';
import DirectoryHero from '@/features/universities/DirectoryHero';
import DirectoryResults from '@/features/universities/DirectoryResults';
import { DirectoryProvider } from '@/features/universities/DirectoryState';
import styles from '@/features/universities/Directory.module.css';
import { UNIVERSITY_QUERY_KEYS, getCatalog, getUniversities, getUniversityFacets, universityQuery } from '@/lib/api/catalog';
import { requireStudentSession } from '@/lib/api/session';

const text = (value) => String((Array.isArray(value) ? value[0] : value) ?? '').trim().slice(0, 120);

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const where = text(params.city) || text(params.state) || 'India';
  const filtered = UNIVERSITY_QUERY_KEYS.some((key) => key !== 'sort' && text(params[key]));
  return {
    title: `Universities and colleges in ${where} | Gyaan Vidhya`,
    description: `Search universities and colleges in ${where} by name, state, city, stream, type and NAAC grade, then apply through Gyaan Vidhya.`,
    robots: filtered ? { index: false, follow: true } : undefined,
    alternates: { canonical: '/universities' },
  };
}

export default async function UniversitiesPage({ searchParams }) {
  const raw = await searchParams;
  const params = Object.fromEntries(UNIVERSITY_QUERY_KEYS.map((key) => [key, text(raw[key])]).filter(([, value]) => value));
  const [, result, facets, catalog] = await Promise.all([
    requireStudentSession(),
    getUniversities(universityQuery(params)),
    getUniversityFacets(params.state),
    getCatalog(),
  ]);
  // One event per distinct search/filter combination. `results` is what feeds the admin content-gap list.
  const searched = Boolean(params.q || params.state || params.city || params.stream || params.course);
  return <main id="main" tabIndex={-1} className={styles.page}>
    <DirectoryProvider params={params}>
      <DirectoryHero params={params} facets={facets} result={result} />
      <DirectoryResults params={params} result={result} facets={facets} courses={catalog.courses} />
      {searched && !result.failed && <TrackEvent event={{
        type: 'search', query: params.q, state: params.state, city: params.city,
        stream: params.stream, courseSlug: params.course, results: result.total ?? 0,
      }} />}
      <div className={`lux-container lux-container--wide ${styles.recommended}`}>
        <RecommendedUniversities limit={6} courseNames={Object.fromEntries(catalog.courses.map((course) => [course.id, course.name]))} />
      </div>
    </DirectoryProvider>
  </main>;
}
