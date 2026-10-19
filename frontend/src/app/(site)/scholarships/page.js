import { GuideUnavailable } from '@/features/guides/GuidePage';
import Scholarships from '@/features/guides/Scholarships';
import { guideMetadata, loadGuides } from '@/features/guides/data';
import { getCatalog } from '@/lib/api/catalog';
import { getContent } from '@/lib/api/content';

const SLUG = 'scholarships';

export async function generateMetadata() {
  return guideMetadata(await loadGuides(getContent), SLUG, 'Scholarships & funding');
}

export default async function ScholarshipsPage() {
  const [{ scholarships }, guides] = await Promise.all([getCatalog(), loadGuides(getContent)]);
  const guide = guides?.guides[SLUG];
  if (!guide) return <main id="main" tabIndex={-1}><GuideUnavailable /></main>;
  return <Scholarships guides={guides} guide={guide} portals={scholarships} />;
}
