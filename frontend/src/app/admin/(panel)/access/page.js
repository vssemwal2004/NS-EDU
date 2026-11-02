import { connection } from 'next/server';
import AccessManager from '@/features/admin/access/AccessManager';

export const metadata = { title: 'Team & access' };

// Rendered per request: the screen reads `?tab=`, `?add=1` and `?actor=` from the URL.
export default async function AccessPage() {
  await connection();
  return <AccessManager />;
}
