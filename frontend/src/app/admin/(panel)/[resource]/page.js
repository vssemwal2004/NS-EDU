import { notFound } from 'next/navigation';
import ResourceManager from '@/features/admin/ResourceManager';
import { manageableResources } from '@/features/admin/resource-config';
import { adminPages } from '@/data/admin-navigation';

export async function generateMetadata({ params }) {
  const { resource } = await params;
  return { title: adminPages.find((page) => page.resource === resource)?.label || 'Not found' };
}

export default async function AdminResourcePage({ params, searchParams }) {
  const { resource } = await params;
  const { new: startCreating } = await searchParams;
  if (!manageableResources.includes(resource)) notFound();
  return <ResourceManager key={resource} resource={resource} startCreating={startCreating === '1'} />;
}
