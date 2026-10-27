import { notFound } from 'next/navigation';
import DriveDetail from '@/features/admin/drives/DriveDetail';

export const metadata = { title: 'School drive' };

export default async function DrivePage({ params, searchParams }) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  const { tab } = await searchParams;
  return <DriveDetail key={id} id={id} initialTab={typeof tab === 'string' ? tab : 'builder'} />;
}
