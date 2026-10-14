'use client';
import LandingFirstScreen from '@/features/landing/LandingPage';
import LocationDiscovery from '@/features/landing/LocationDiscovery';
import EducationNews from '@/features/landing/EducationNews';
import { BudgetView, CollegesView, EligibilityView } from '@/features/site/SectionViews';
import { featureDirectory } from '@/data/landing';
import { formatTuition } from '@/lib/college-catalog';
import { useCatalog } from '@/providers/CatalogProvider';
import { HomeSectionLink } from './HomeParts';
import { plural } from './placeCounts';
import StatStrip from './StatStrip';
import StreamBand from './StreamBand';
import ComparePromo from './ComparePromo';
import ExamsBand from './ExamsBand';

// Homepage order (fixed): 1 first screen · A at a glance · 2 destinations · B streams ·
// 3 colleges · C compare · 4 eligibility · D exams · 5 budget · 6 news.
// Sections 3–6 keep their approved designs; a "View all" row follows each one.
export default function HomePage() {
  const { courses, colleges } = useCatalog();
  const fees = colleges.map((row) => row.annualTuitionInr).filter(Number.isFinite);
  const institutions = new Set(colleges.map((row) => row.collegeId)).size;
  const metas = {
    colleges: [plural(colleges.length, 'sample programme'), plural(institutions, 'institution'), fees.length && `annual tuition ${formatTuition(Math.min(...fees))}–${formatTuition(Math.max(...fees))}`, 'Illustrative data'].filter(Boolean).join(' · '),
    eligibility: `Step-by-step · ${plural(courses.length, 'course')} · confirm with each institution`,
  };
  const link = Object.fromEntries(featureDirectory.map((item) => [item.id, <HomeSectionLink key={item.id} {...item} meta={metas[item.id] || item.meta} narrow={item.id !== 'colleges'} />]));

  return <main id="main" tabIndex={-1}>
    <LandingFirstScreen />
    <StatStrip />
    <LocationDiscovery variant="home" />
    <StreamBand />
    <CollegesView />
    {link.colleges}
    <ComparePromo />
    <EligibilityView />
    {link.eligibility}
    <ExamsBand />
    <BudgetView />
    {link.budget}
    <EducationNews />
    {link.news}
  </main>;
}
