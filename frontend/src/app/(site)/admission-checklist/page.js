import AdmissionChecklist from '@/features/guides/AdmissionChecklist';
import { GuideUnavailable } from '@/features/guides/GuidePage';
import { guideMetadata, loadGuides } from '@/features/guides/data';
import { getCatalog } from '@/lib/api/catalog';
import { getContent } from '@/lib/api/content';

const SLUG = 'admission-checklist';

export async function generateMetadata() {
  return guideMetadata(await loadGuides(getContent), SLUG, 'Admission checklist');
}

export default async function AdmissionChecklistPage() {
  const [{ exams }, guides] = await Promise.all([getCatalog(), loadGuides(getContent)]);
  const guide = guides?.guides[SLUG];
  if (!guide) return <main id="main" tabIndex={-1}><GuideUnavailable /></main>;
  return <AdmissionChecklist guides={guides} guide={guide} exams={exams} />;
}
