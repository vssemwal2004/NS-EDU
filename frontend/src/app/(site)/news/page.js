import PageIntro from '@/components/layout/PageIntro';
import EducationNews from '@/features/landing/EducationNews';
import { getContent } from '@/lib/api/content';
import { ContentProvider } from '@/providers/ContentProvider';

export const metadata = { title: 'Education news & articles | Gyaan Vidhya', description: 'Dated education updates from Indian publishers, with links to the original stories.' };

export default async function NewsPage() {
  const content = await getContent(['news']);
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Education news" icon="news" title="Education news" accent="& articles" description="Admissions, exams, results and policy updates — dated, sourced and linked to the original publisher."
      meta="Stories open on the original publisher’s site, with the publish date shown. Confirm deadlines in the official notice."
      related={[{ href: '/exams', icon: 'document', label: 'Exam guides' }, { href: '/admission-checklist', icon: 'guidesChecklist', label: 'Admission checklist' }, { href: '/sources-and-editorial', icon: 'book', label: 'Sources & editorial approach' }]} />
    <ContentProvider content={content}><EducationNews /></ContentProvider>
  </main>;
}
