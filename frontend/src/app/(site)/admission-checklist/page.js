import PageIntro from '@/components/layout/PageIntro';
import GuidePage, { GuideUnavailable } from '@/features/guides/GuidePage';
import { ExamLinks } from '@/features/guides/GuideBlocks';
import { getCatalog } from '@/lib/api/catalog';
import { getContent } from '@/lib/api/content';

const SLUG = 'admission-checklist';
const loadGuide = async () => (await getContent(['guides'])).guides;

export async function generateMetadata() {
  const page = (await loadGuide())?.guides[SLUG]?.page;
  return page ? { title: `${page.title} | Gyaan Vidhya`, description: page.description } : { title: 'Admission checklist | Gyaan Vidhya' };
}

export default async function AdmissionChecklistPage() {
  const [{ exams }, guides] = await Promise.all([getCatalog(), loadGuide()]);
  const guide = guides?.guides[SLUG];
  const sections = guide && [...guide.page.sections, ...(guide.catalogSection ? [{ ...guide.catalogSection, content: exams.length > 0 && <ExamLinks exams={exams} /> }] : [])];
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Admission checklist" icon="guidesChecklist" title="Before you" accent="apply" description={`${guide?.page.description ?? ''} Confirm the programme, track dates and documents, and review costs before you submit anything.`.trim()}
      stats={[...(guide ? [{ value: sections.length, label: 'Steps' }, { value: guide.checklist.items.length, label: 'Documents to prepare' }] : []), { value: exams.length, label: 'Official exam sites' }]}
      statsNote="Your institution’s notice is the final word."
      related={[{ href: '/eligibility', icon: 'eligibility', label: 'Check eligibility' }, { href: '/budget', icon: 'wallet', label: 'Budget check' }, { href: '/exams', icon: 'document', label: 'Exam guides' }, { href: '/scholarships', icon: 'cap', label: 'Scholarships' }]} />
    {guide ? <GuidePage guide={SLUG} content={guides} sections={sections} /> : <GuideUnavailable />}
  </main>;
}
