import PageIntro from '@/components/layout/PageIntro';
import ExamsDirectory from '@/features/courses/ExamsDirectory';

export const metadata = { title: 'Entrance exam guides — official sources & related courses | Gyaan Vidhya', description: 'Official links and starting points for major entrance exams in India, with the courses each exam is commonly used for.' };

const text = (value) => (Array.isArray(value) ? value[0] : value) || '';

export default async function ExamsPage({ searchParams }) {
  const { q, field } = await searchParams;
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Exams" icon="document" title="Entrance exam" accent="guides" description="Go straight to the official source for eligibility, syllabus and dates — then see which courses each exam leads to."
      related={[{ href: '/news', icon: 'news', label: 'Exam & results news' }, { href: '/eligibility', icon: 'eligibility', label: 'Check eligibility' }, { href: '/admission-checklist', icon: 'document', label: 'Admission checklist' }]} />
    <ExamsDirectory initialQuery={text(q)} initialField={text(field)} />
  </main>;
}
