import PageIntro from '@/components/layout/PageIntro';
import { BudgetView } from '@/features/site/SectionViews';

export const metadata = { title: 'College budget check | NSEDU', description: 'Estimate first-year tuition, accommodation, meals and one-time costs against your budget.' };

export default async function BudgetPage({ searchParams }) {
  const { course = '' } = await searchParams;
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Budget check" icon="wallet" title="Can this college" accent="fit your budget?" description="Add tuition, living and one-time costs together, then find colleges within your first-year budget."
      related={[{ href: '/scholarships', icon: 'cap', label: 'Scholarships' }, { href: '/compare', icon: 'scales', label: 'Compare colleges' }]} />
    <BudgetView initialCourse={String(course)} />
  </main>;
}
