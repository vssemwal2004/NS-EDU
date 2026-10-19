import CareerGuidance from '@/features/guides/CareerGuidance';
import { GuideUnavailable } from '@/features/guides/GuidePage';
import { guideMetadata, loadGuides } from '@/features/guides/data';
import { getCatalog } from '@/lib/api/catalog';
import { getContent } from '@/lib/api/content';

const SLUG = 'career-guidance';

export async function generateMetadata() {
  return guideMetadata(await loadGuides(getContent), SLUG, 'Career guidance');
}

export default async function CareerGuidancePage() {
  const [{ courses, exams }, guides] = await Promise.all([getCatalog(), loadGuides(getContent)]);
  const guide = guides?.guides[SLUG];
  if (!guide) return <main id="main" tabIndex={-1}><GuideUnavailable /></main>;
  return <CareerGuidance guides={guides} guide={guide} courses={courses} exams={exams} />;
}
