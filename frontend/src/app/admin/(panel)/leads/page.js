import LeadsManager from '@/features/admin/leads/LeadsManager';

export const metadata = { title: 'Leads' };

export default async function LeadsPage({ searchParams }) {
  return <LeadsManager initial={await searchParams} />;
}
