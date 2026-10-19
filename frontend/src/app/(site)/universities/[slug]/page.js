import { notFound } from 'next/navigation';
import RecommendedUniversities from '@/features/recommendations/RecommendedUniversities';
import TrackEvent from '@/features/recommendations/TrackEvent';
import { kindOf, lakhRange, placeOf } from '@/features/universities/labels';
import UniversityProfile from '@/features/universities/profile/UniversityProfile';
import { profileModel } from '@/features/universities/profile/profile-data';
import styles from '@/features/universities/profile/Profile.module.css';
import { getCatalog, getUniversity } from '@/lib/api/catalog';
import { requireStudentSession } from '@/lib/api/session';

async function load(slug) {
  const [detail, catalog] = await Promise.all([getUniversity(decodeURIComponent(slug)), getCatalog()]);
  return detail ? { model: profileModel(detail, catalog.courses), catalog } : null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: 'University not found | Gyaan Vidhya' };
  const { item, summary } = data.model;
  const facts = [kindOf(item), placeOf(item), item.establishedYear && `established ${item.establishedYear}`, item.naacGrade && `NAAC ${item.naacGrade}`].filter(Boolean).join(' · ');
  return {
    title: `${item.name}${item.city ? `, ${item.city}` : ''}: courses, fees, admission & contact | Gyaan Vidhya`,
    description: `${facts}.${summary?.feeMin != null ? ` Annual tuition ${lakhRange(summary.feeMin, summary.feeMax)} (${summary.tuitionYear}).` : ''} Apply to ${item.shortName || item.name} through Gyaan Vidhya.`.slice(0, 300),
    alternates: { canonical: `/universities/${item.id}` },
  };
}

export default async function UniversityProfilePage({ params }) {
  const { slug } = await params;
  const [, data] = await Promise.all([requireStudentSession(), load(slug)]);
  if (!data) notFound();
  const courseNames = Object.fromEntries(data.catalog.courses.map((course) => [course.id, course.name]));
  const { item } = data.model;
  return <main id="main" tabIndex={-1} className={styles.page}>
    <UniversityProfile model={data.model} courseNames={courseNames} />
    <TrackEvent event={{ type: 'view', institutionSlug: item.id, city: item.city, state: item.state || '' }} />
    <div className={`lux-container ${styles.recommended}`}>
      <RecommendedUniversities exclude={item.id} eyebrow="Keep looking" title="Students who looked here also considered" courseNames={courseNames} />
    </div>
  </main>;
}
