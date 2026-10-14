import PageIntro from '@/components/layout/PageIntro';
import CollegeListing from '@/features/colleges/CollegeListing';
import { getCatalog } from '@/lib/api/catalog';

export const metadata = { title: 'Colleges by course, location & fees | NSEDU', description: 'Filter illustrative colleges by stream, course, location, annual tuition and demo rating, then compare fees and placements.' };

const text = (value) => String((Array.isArray(value) ? value[0] : value) || '');
const KEYS = ['course', 'location', 'field', 'fee', 'rating', 'sort', 'q'];

export default async function CollegesPage({ searchParams }) {
  const [params, catalog] = await Promise.all([searchParams, getCatalog()]);
  const initial = Object.fromEntries(KEYS.map((key) => [key, text(params[key])]));
  const institutions = new Set(catalog.colleges.map((row) => row.collegeId)).size;
  const places = new Set(catalog.colleges.map((row) => row.city)).size;
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Colleges" icon="cap" title="Find colleges for" accent="your course"
      description={`Filter ${institutions} illustrative institutions and ${catalog.colleges.length} programmes across ${places} cities by stream, course, location, annual tuition and demo rating. Shortlist up to three per course to compare.`}
      related={[{ href: '/compare', icon: 'scales', label: 'Compare colleges' }, { href: '/locations', icon: 'location', label: 'Browse by location' }, { href: '/budget', icon: 'wallet', label: 'Check your budget' }]} />
    <CollegeListing initial={initial} />
  </main>;
}
