import PageIntro from '@/components/layout/PageIntro';
import UniversityDirectory from '@/features/universities/UniversityDirectory';
import { formatCount } from '@/features/universities/labels';
import { UNIVERSITY_QUERY_KEYS, getUniversities, getUniversityFacets, universityQuery } from '@/lib/api/catalog';

const text = (value) => String((Array.isArray(value) ? value[0] : value) ?? '').trim().slice(0, 120);

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const where = text(params.city) || text(params.state) || 'India';
  const filtered = UNIVERSITY_QUERY_KEYS.some((key) => key !== 'sort' && text(params[key]));
  return {
    title: `Universities and colleges in ${where} | Gyaan Vidhya`,
    description: `Search universities and colleges in ${where} by name, state, city, stream, type and NAAC grade, then apply through Gyaan Vidhya.`,
    // Filtered and paged combinations stay crawlable for links but are not indexed as separate pages.
    robots: filtered ? { index: false, follow: true } : undefined,
    alternates: { canonical: '/universities' },
  };
}

export default async function UniversitiesPage({ searchParams }) {
  const raw = await searchParams;
  const params = Object.fromEntries(UNIVERSITY_QUERY_KEYS.map((key) => [key, text(raw[key])]).filter(([, value]) => value));
  const [result, facets] = await Promise.all([getUniversities(universityQuery(params)), getUniversityFacets(params.state)]);
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Universities" icon="building" title="Find your" accent="university"
      description={`Search ${facets.total ? formatCount(facets.total) : 'every'} universities and colleges across ${facets.states.length ? `${facets.states.length} states and union territories` : 'India'}. Filter by location, stream, type and accreditation, then apply in a few steps.`}
      related={[{ href: '/apply', icon: 'document', label: 'Start an application' }, { href: '/compare', icon: 'scales', label: 'Compare fees' }, { href: '/admission-checklist', icon: 'eligibility', label: 'Admission checklist' }]} />
    <UniversityDirectory result={result} facets={facets} params={params} />
  </main>;
}
