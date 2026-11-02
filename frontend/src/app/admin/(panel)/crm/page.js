import CrmDashboard from '@/features/admin/crm-dashboard/CrmDashboard';

export const metadata = { title: 'CRM performance' };

export default async function CrmDashboardPage({ searchParams }) {
  return <CrmDashboard initial={await searchParams} />;
}
