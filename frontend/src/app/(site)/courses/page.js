import PageIntro from '@/components/layout/PageIntro';
import CoursesDirectory from '@/features/courses/CoursesDirectory';
import IntroStats from '@/features/courses/IntroStats';
import { getCatalog } from '@/lib/api/catalog';

export const metadata = { title: 'Courses by field & level — fees, colleges & exams | Gyaan Vidhya', description: 'Explore undergraduate and postgraduate courses by field, compare sample fees and placements, then find colleges and check eligibility.' };

const text = (value) => (Array.isArray(value) ? value[0] : value) || '';

export default async function CoursesPage({ searchParams }) {
  const [params, catalog] = await Promise.all([searchParams, getCatalog()]);
  const stats = [
    { label: 'Courses', value: catalog.courses.length },
    { label: 'Fields', value: new Set(catalog.courses.map((course) => course.field)).size },
    { label: 'Programmes', value: catalog.colleges.length },
    { label: 'Institutions', value: new Set(catalog.colleges.map((row) => row.collegeId)).size },
  ];
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Courses" icon="book" title="Explore courses" accent="by field & level" description="Start with what you want to study, then see sample fees, placements, colleges and linked exams for each course."
      related={[{ href: '/eligibility', icon: 'eligibility', label: 'Check eligibility' }, { href: '/career-guidance', icon: 'compass', label: 'Career guidance' }]}>
      <IntroStats items={stats} note="Illustrative sample institutions · not a ranking" />
    </PageIntro>
    <CoursesDirectory initialField={text(params.field)} initialLevel={text(params.level)} initialQuery={text(params.q)} initialSort={text(params.sort) || 'featured'} />
  </main>;
}
