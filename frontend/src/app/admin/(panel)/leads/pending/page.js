import LeadsManager from '@/features/admin/leads/LeadsManager';

export const metadata = { title: 'Pending leads' };

export default function PendingLeadsPage() {
  return <LeadsManager heading="Pending leads" fixedFilters={{ status: 'new' }} syncUrl={false} />;
}
