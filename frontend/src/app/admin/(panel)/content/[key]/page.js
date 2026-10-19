import ContentEditor from '@/features/admin/content/ContentEditor';

export const metadata = { title: 'Edit site content' };

export default async function SiteContentEditorPage({ params }) {
  const { key } = await params;
  return <ContentEditor key={key} contentKey={key} />;
}
