import PageIntro from '@/components/layout/PageIntro';
import GuidePage from '@/features/guides/GuidePage';
import { ExamLinks } from '@/features/guides/GuideBlocks';
import { guides } from '@/features/guides/data';
import { toolGuides } from '@/data/landing';
import { sitePages } from '@/data/site-pages';
import { getCatalog } from '@/lib/api/catalog';

const page = sitePages['admission-checklist'];
export const metadata = { title: `${page.title} | NSEDU`, description: page.description };

export default async function AdmissionChecklistPage() {
  const { exams } = await getCatalog();
  const sections = [...page.sections, {
    title: 'Go to the official exam website', toc: 'Official exam websites',
    text: 'If your route uses a national entrance exam, read its official information bulletin for eligibility, dates and the documents to bring. NSEDU’s exam guides show which courses each exam leads to.',
    content: exams.length > 0 && <ExamLinks exams={exams} />,
    links: [{ label: 'All exam guides', href: '/exams' }],
  }];
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Admission checklist" icon="guidesChecklist" title="Before you" accent="apply" description={`${page.description} Confirm the programme, track dates and documents, and review costs before you submit anything.`}
      stats={[{ value: page.sections.length + 1, label: 'Steps' }, { value: guides['admission-checklist'].checklist.items.length, label: 'Documents to prepare' }, { value: exams.length, label: 'Official exam sites' }]}
      statsNote="Your institution’s notice is the final word."
      related={[{ href: '/eligibility', icon: 'eligibility', label: 'Check eligibility' }, { href: '/budget', icon: 'wallet', label: 'Budget check' }, { href: '/exams', icon: 'document', label: 'Exam guides' }, { href: '/scholarships', icon: 'cap', label: 'Scholarships' }]} />
    <GuidePage guide="admission-checklist" sections={sections} note={toolGuides.admissions.note} />
  </main>;
}
