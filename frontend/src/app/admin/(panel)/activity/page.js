import { Suspense } from 'react';
import ActivityLog from '@/features/admin/activity/ActivityLog';

export const metadata = { title: 'Activity log' };

export default function ActivityPage() {
  return <Suspense fallback={null}><ActivityLog /></Suspense>;
}
