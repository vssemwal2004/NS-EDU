import InsightsDashboard from '@/features/admin/insights/InsightsDashboard';

export const metadata = { title: 'Search insights' };

// searchParams is a Promise in this Next.js version.
export default async function InsightsPage({ searchParams }) {
  return <InsightsDashboard initial={await searchParams} />;
}
