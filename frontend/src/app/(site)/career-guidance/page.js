import PageIntro from '@/components/layout/PageIntro';
import GuidePage from '@/features/guides/GuidePage';
import { FieldExplorer } from '@/features/guides/GuideBlocks';
import { toolGuides } from '@/data/landing';
import { sitePages } from '@/data/site-pages';
import { getCatalog } from '@/lib/api/catalog';

const page = sitePages['career-guidance'];
export const metadata = { title: `${page.title} | NSEDU`, description: page.description };

export default async function CareerGuidancePage() {
  const { courses, colleges, exams } = await getCatalog();
  const fields = new Set(courses.map((course) => course.field)).size;
  const sections = [...page.sections, {
    title: 'Explore courses by field', toc: 'Explore by field',
    text: 'Every course NSEDU lists, grouped by field. Open a course for its sample colleges, fees and linked exams, or jump straight to the colleges that offer it.',
    content: <FieldExplorer courses={courses} colleges={colleges} />,
  }];
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Career guidance" icon="compass" title="Find your" accent="direction" description={`${page.description} Work out what you enjoy, which courses lead there and what fits your circumstances.`}
      stats={[{ value: courses.length, label: 'Courses' }, { value: fields, label: 'Fields' }, { value: exams.length, label: 'Exam guides' }]}
      statsNote="Counts from the NSEDU catalogue."
      related={[{ href: '/courses', icon: 'book', label: 'Explore courses' }, { href: '/eligibility', icon: 'eligibility', label: 'Check eligibility' }, { href: '/exams', icon: 'document', label: 'Exam guides' }]} />
    <GuidePage guide="career-guidance" sections={sections} note={toolGuides.guidance.note} />
  </main>;
}
