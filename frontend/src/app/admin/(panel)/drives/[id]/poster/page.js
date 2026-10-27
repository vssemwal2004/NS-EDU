import { notFound } from 'next/navigation';
import DrivePoster from '@/features/admin/drives/DrivePoster';
import './poster-print.css';

export const metadata = { title: 'Drive poster' };

export default async function DrivePosterPage({ params }) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  return <DrivePoster id={id} />;
}
