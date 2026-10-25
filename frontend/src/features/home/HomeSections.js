'use client';
import LandingFirstScreen from '@/features/landing/LandingPage';
import LocationDiscovery from '@/features/landing/LocationDiscovery';
import EducationNews from '@/features/landing/EducationNews';
import { BudgetView, EligibilityView } from '@/features/site/SectionViews';
import { useCatalog } from '@/providers/CatalogProvider';
import { useContent } from '@/providers/ContentProvider';
import { HomeSectionLink } from './HomeParts';
import { plural } from './placeCounts';
import StatStrip from './StatStrip';
import StreamBand from './StreamBand';
import TopColleges from './TopColleges';
import ComparePromo from './ComparePromo';
import ExamsBand from './ExamsBand';

// Homepage order (fixed): 1 first screen · A at a glance · 2 destinations · B streams ·
// 3 colleges · C compare · 4 eligibility · D exams · 5 budget · 6 news.
// A "View all" row follows sections 3–6.
export default function HomeSections() {
  const { courses, stats } = useCatalog();
  const featureDirectory = useContent('landing')?.featureDirectory ?? [];
  const metas = {
    colleges: [stats?.institutions && `${new Intl.NumberFormat('en-IN').format(stats.institutions)} institutions`, stats?.statesWithInstitutions && `${stats.statesWithInstitutions} states & UTs`, plural(courses.length, 'course')].filter(Boolean).join(' · '),
    eligibility: `Step-by-step · ${plural(courses.length, 'course')} · confirm with each institution`,
  };
  const link = Object.fromEntries(featureDirectory.map((item) => [item.id, <HomeSectionLink key={item.id} {...item} meta={metas[item.id] || item.meta} narrow={item.id !== 'colleges'} />]));

  return <main id="main" tabIndex={-1}>
    <LandingFirstScreen />
    <StatStrip />
    <LocationDiscovery variant="home" />
    <StreamBand />
    <TopColleges />
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
