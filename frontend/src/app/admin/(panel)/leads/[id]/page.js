import { notFound } from 'next/navigation';
import LeadDetail from '@/features/admin/leads/LeadDetail';

export const metadata = { title: 'Lead' };

export default async function LeadPage({ params }) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  return <LeadDetail key={id} id={id} />;
}
