import PageIntro from '@/components/layout/PageIntro';
import GuidePage, { GuideUnavailable } from '@/features/guides/GuidePage';
import { FieldExplorer } from '@/features/guides/GuideBlocks';
import { getCatalog } from '@/lib/api/catalog';
import { getContent } from '@/lib/api/content';

const SLUG = 'career-guidance';
const loadGuide = async () => (await getContent(['guides'])).guides;

export async function generateMetadata() {
  const page = (await loadGuide())?.guides[SLUG]?.page;
  return page ? { title: `${page.title} | Gyaan Vidhya`, description: page.description } : { title: 'Career guidance | Gyaan Vidhya' };
}

export default async function CareerGuidancePage() {
  const [{ courses, colleges, exams }, guides] = await Promise.all([getCatalog(), loadGuide()]);
  const guide = guides?.guides[SLUG];
  const fields = new Set(courses.map((course) => course.field)).size;
  const sections = guide && [...guide.page.sections, ...(guide.catalogSection ? [{ ...guide.catalogSection, content: <FieldExplorer courses={courses} colleges={colleges} /> }] : [])];
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Career guidance" icon="compass" title="Find your" accent="direction" description={`${guide?.page.description ?? ''} Work out what you enjoy, which courses lead there and what fits your circumstances.`.trim()}
      stats={[{ value: courses.length, label: 'Courses' }, { value: fields, label: 'Fields' }, { value: exams.length, label: 'Exam guides' }]}
      statsNote="Counts from the Gyaan Vidhya catalogue."
      related={[{ href: '/courses', icon: 'book', label: 'Explore courses' }, { href: '/eligibility', icon: 'eligibility', label: 'Check eligibility' }, { href: '/exams', icon: 'document', label: 'Exam guides' }]} />
    {guide ? <GuidePage guide={SLUG} content={guides} sections={sections} /> : <GuideUnavailable />}
  </main>;
}
