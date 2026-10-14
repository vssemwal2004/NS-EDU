import PageIntro from '@/components/layout/PageIntro';
import CompareSteps from '@/features/compare/CompareSteps';
import CompareView from '@/features/compare/CompareView';
import { joinNames } from '@/features/compare/compare-data';
import { getCatalog } from '@/lib/api/catalog';

const listParam = (value) => (Array.isArray(value) ? value.join(',') : String(value || ''));

export async function generateMetadata({ searchParams }) {
  const { course = '', c = '' } = await searchParams;
  const description = 'Pick a course, add up to three colleges and see fees, placements and data years side by side.';
  const catalog = await getCatalog();
  const programme = catalog.courses.find((item) => item.id === listParam(course));
  const ids = listParam(c).split(',').filter(Boolean);
  const rows = ids.map((id) => catalog.colleges.find((row) => row.id === id && row.courseId === programme?.id)).filter(Boolean).slice(0, 3);
  if (rows.length > 1) return { title: `${joinNames(rows)}: ${programme.name} comparison | NSEDU`, description };
  if (programme) return { title: `Compare ${programme.name} colleges | NSEDU`, description };
  return { title: 'Compare colleges | NSEDU', description };
}

export default async function ComparePage({ searchParams }) {
  const { course = '', c = '' } = await searchParams;
  const initialCourse = listParam(course);
  const initialList = listParam(c);
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Compare" icon="scales" title="Compare colleges" accent="side by side" description="Pick a course, add up to three colleges and see fees, placements and data years side by side."
      related={[{ href: '/colleges', icon: 'cap', label: 'Find colleges' }, { href: '/budget', icon: 'wallet', label: 'Estimate full costs' }, { href: '/eligibility', icon: 'eligibility', label: 'Check eligibility' }]}>
      <CompareSteps />
    </PageIntro>
    {/* Keyed so a suggestion link to new ?course/&c values resets the client state. */}
    <CompareView key={`${initialCourse}|${initialList}`} initialCourse={initialCourse} initialList={initialList} />
  </main>;
}
