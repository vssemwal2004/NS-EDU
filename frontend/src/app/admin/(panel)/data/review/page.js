import ReviewQueue from '@/features/admin/data/ReviewQueue';

export const metadata = { title: 'Review queue' };

export default async function ReviewQueuePage({ searchParams }) {
  const { view, source } = await searchParams;
  return <ReviewQueue initialView={typeof view === 'string' ? view : 'held'} initialSource={typeof source === 'string' ? source : ''} />;
}
