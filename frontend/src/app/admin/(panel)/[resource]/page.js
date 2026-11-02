import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ResourceManager from '@/features/admin/ResourceManager';
import { manageableResources } from '@/features/admin/resource-config';
import { adminPages } from '@/data/admin-navigation';

export async function generateMetadata({ params }) {
  const { resource } = await params;
  return { title: adminPages.find((page) => page.resource === resource)?.label || 'Not found' };
}

// ?q= (search) and ?new=1 (open the add form) are read in the client screen, so links that change
// only the query string (command palette, "New" menu) update an already-open list.
export default async function AdminResourcePage({ params }) {
  const { resource } = await params;
  if (!manageableResources.includes(resource)) notFound();
  return <Suspense><ResourceManager key={resource} resource={resource} /></Suspense>;
}
