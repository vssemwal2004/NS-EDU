import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { mergeUniversities, Results, SEARCH_TABS, Suggestions, TabBar, tabHref } from '@/features/newsroom/PaletteResults';
import SearchPalette from '@/features/newsroom/SearchPalette';
import TrackEvent from '@/features/recommendations/TrackEvent';
import { getCatalog, getUniversities, searchCatalog, universityQuery } from '@/lib/api/catalog';
import { requireStudentSession } from '@/lib/api/session';
import styles from '@/features/newsroom/Search.module.css';

export const metadata = { title: 'Search | Gyaan Vidhya', robots: { index: false, follow: true } };

const text = (value) => String((Array.isArray(value) ? value[0] : value) || '');

export default async function SearchPage({ searchParams }) {
  await requireStudentSession();
  const params = await searchParams;
  const query = text(params.q).trim().slice(0, 120);
  const requested = text(params.tab) === 'colleges' ? 'universities' : text(params.tab);
  const tab = SEARCH_TABS.some((item) => item.id === requested) ? requested : 'all';
  const [{ results, failed }, directory, catalog] = await Promise.all([
    searchCatalog(query),
    query ? getUniversities(universityQuery({ q: query })) : null,
    getCatalog(),
  ]);
  const universities = mergeUniversities(directory?.failed ? null : directory, results.colleges);
  const exams = results.exams.map((exam) => ({ ...catalog.exams.find((item) => item.id === exam.id), ...exam }));
  const counts = { universities: universities.total, courses: results.courses.length, exams: exams.length };
  counts.all = counts.universities + counts.courses + counts.exams;
  const broken = failed && directory?.failed;

  let body;
  if (!query) body = <Suggestions catalog={catalog} heading="Start typing, or pick a starting point" />;
  else if (broken) body = <div className={styles.note} role="alert"><Icon name="coursesInfo" /><p><strong>Search is temporarily unavailable.</strong> Nothing is wrong with your search — please try again in a moment. <Link className="lux-link" href={tabHref(query, tab)}>Try again<Icon name="refresh" /></Link></p></div>;
  else if (!counts.all) body = <>
    <div className={styles.note} role="status"><Icon name="search" /><p><strong>No matches for “{query}”.</strong> Check the spelling, try a shorter word, or search a course short name such as B.Tech or a city such as Pune.</p></div>
    <Suggestions catalog={catalog} />
  </>;
  else body = <>
    <p className="sr-only" role="status">{counts.all} {counts.all === 1 ? 'result' : 'results'} for “{query}”</p>
    <TabBar query={query} tab={tab} counts={counts} />
    <Results query={query} tab={tab} universities={universities} courses={results.courses} exams={exams} />
  </>;

  return <main id="main" tabIndex={-1} className={styles.page}>
    <div className={`lux-surface-dark ${styles.stage}`}>
      <div className={styles.stageInner}>
        <p className={styles.kicker}><Icon name="newsKeys" />Search Gyaan Vidhya</p>
        <h1 className={styles.title}>{query ? <>Results for <span>“{query}”</span></> : <>Find a university, course <span>or exam.</span></>}</h1>
      </div>
    </div>
    <div className={styles.shell}>
      <SearchPalette query={query} tab={tab}>{body}</SearchPalette>
    </div>
    {/* `results` is the whole-directory total, so a zero lands in the admin content-gap list. */}
    {query && !broken && <TrackEvent event={{ type: 'search', query, results: counts.all }} />}
  </main>;
}
