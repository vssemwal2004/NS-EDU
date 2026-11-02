import ContentEditor from '@/features/admin/content/ContentEditor';

export const metadata = { title: 'Edit site content' };

export default async function SiteContentEditorPage({ params, searchParams }) {
  const { key } = await params;
  const { tab } = await searchParams;
  return <ContentEditor key={key} contentKey={key} initialTab={typeof tab === 'string' ? tab : 'edit'} />;
}
