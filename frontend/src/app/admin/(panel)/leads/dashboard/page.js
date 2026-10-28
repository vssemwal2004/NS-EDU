import LeadsDashboard from '@/features/admin/leads-dashboard/LeadsDashboard';

export const metadata = { title: 'Leads dashboard' };

export default async function LeadsDashboardPage({ searchParams }) {
  return <LeadsDashboard initial={await searchParams} />;
}
