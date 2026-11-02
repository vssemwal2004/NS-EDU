import ImportScreen from '@/features/admin/data/ImportScreen';

export const metadata = { title: 'Import universities and courses' };

export default async function ImportPage({ searchParams }) {
  const { kind } = await searchParams;
  return <ImportScreen initialKind={typeof kind === 'string' ? kind : 'universities'} />;
}
