import PageIntro from '@/components/layout/PageIntro';
import { EligibilityView } from '@/features/site/SectionViews';
import { getContent } from '@/lib/api/content';
import { ContentProvider } from '@/providers/ContentProvider';

export const metadata = { title: 'Check course eligibility | Gyaan Vidhya', description: 'Compare your academic profile with sample course requirements, step by step.' };

export default async function EligibilityPage({ searchParams }) {
  const [{ course = '' }, content] = await Promise.all([searchParams, getContent(['eligibility'])]);
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Eligibility" icon="eligibility" title="Check your" accent="eligibility" description="Answer one question at a time. We explain which requirements match, what is missing and what to do next."
      related={[{ href: '/courses', icon: 'book', label: 'Browse courses' }, { href: '/exams', icon: 'document', label: 'Exam guides' }, { href: '/admission-checklist', icon: 'check', label: 'Admission checklist' }]} />
    <ContentProvider content={content}><EligibilityView initialCourse={String(course)} /></ContentProvider>
  </main>;
}
