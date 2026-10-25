'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import UniversityCard from '@/features/universities/UniversityCard';
import { useCourseSelection } from '@/features/site/useCourseSelection';
import { api } from '@/lib/api/client';
import { useCatalog } from '@/providers/CatalogProvider';
import { useConsent } from '@/providers/ConsentProvider';
import { useContent } from '@/providers/ContentProvider';
import styles from './TopColleges.module.css';

const SHOWN = 6;
const FOR_YOU = '';
const number = new Intl.NumberFormat('en-IN');

// Homepage colleges, from the recommendation engine (/api/insights/home — backend/src/modules/insights/recommend.js).
// With personalisation consent the list is ranked on the visitor's own searches, filters and profile
// views (recency-weighted, already-seen pages damped), and each card says why it is there. Without
// consent, or before there is any activity, the same endpoint returns the leading institutions for
// the course by NIRF rank and NAAC grade. Only basic card details come back, so this stays public;
// opening a profile asks the student to log in.
export default function TopColleges() {
  const { courses, stats } = useCatalog();
  const { ready, personalisation, reopen } = useConsent();
  const config = useContent('explorer');
  const courseCounts = useMemo(() => stats?.courseCounts ?? {}, [stats]);
  const courseTabs = useMemo(() => {
    const preferred = (config?.courseTabs ?? []).map((id) => courses.find((course) => course.id === id)).filter(Boolean);
    const list = preferred.length ? preferred : courses.toSorted((a, b) => (courseCounts[b.id] ?? 0) - (courseCounts[a.id] ?? 0));
    return list.filter((course) => (courseCounts[course.id] ?? 0) > 0).slice(0, 10);
  }, [config, courses, courseCounts]);
  const [chosen, setChosen] = useCourseSelection();
  // "For you" leads when the visitor allows personalisation and has not picked a course here.
  const [forYou, setForYou] = useState(true);
  const current = personalisation && forYou ? null : courseTabs.find((course) => course.id === chosen) ?? courseTabs[0];
  const tabId = current?.id ?? FOR_YOU;
  const courseNames = useMemo(() => Object.fromEntries(courses.map((course) => [course.id, course.name])), [courses]);
  const [results, setResults] = useState({});
  const [failed, setFailed] = useState(false);
  const cacheKey = `${personalisation ? 'p' : 'n'}:${tabId}`;

  useEffect(() => {
    if (!ready || results[cacheKey]) return undefined;
    const controller = new AbortController();
    api(`/insights/home?limit=${SHOWN}${tabId ? `&course=${encodeURIComponent(tabId)}` : ''}`, { signal: controller.signal })
      .then((data) => { setFailed(false); setResults((previous) => ({ ...previous, [cacheKey]: data })); })
      .catch((error) => { if (error.name !== 'AbortError') setFailed(true); });
    return () => controller.abort();
  }, [ready, cacheKey, tabId, results]);

  if (!courseTabs.length) return null;
  const data = results[cacheKey];
  const items = data?.items;
  const personal = Boolean(data?.personalised);
  const tabs = personalisation ? [{ id: FOR_YOU, name: 'For you' }, ...courseTabs] : courseTabs;

  function select(id) {
    if (id === FOR_YOU) { setForYou(true); return; }
    setForYou(false);
    setChosen(id);
  }
  function onTabKey(event, index) {
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const next = (index + delta + tabs.length) % tabs.length;
    select(tabs[next].id);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  }

  const heading = personal
    ? { eyebrow: 'Recommended for you', title: current ? `${current.name} colleges picked for you` : 'Colleges picked for you',
      lede: 'Ranked on what you have searched and opened on Gyaan Vidhya — every card says why it is here. The more you explore, the sharper it gets.' }
    : { eyebrow: 'Top colleges by course', title: 'Course-wise colleges in India',
      lede: 'Leading institutions for each course, by NIRF rank and NAAC grade — open any profile for fees, placements and campus photos.' };

  let body;
  if (items?.length) body = <ul className={styles.grid} id="top-colleges-panel" role="tabpanel" aria-labelledby={`top-colleges-tab-${tabId || 'for-you'}`}>
    {items.map((item) => <li key={item.id}><UniversityCard item={item} courseNames={courseNames} reason={personal ? item.reason : ''} /></li>)}
  </ul>;
  else if (items || failed) body = <div className={styles.empty}>
    <Icon name="building" />
    <h3>{failed ? 'Colleges are loading slowly' : `No ${current?.name ?? ''} colleges listed yet`}</h3>
    <p>{failed ? 'Please try again in a moment.' : 'The directory is still being filled in for this course.'}</p>
    {current && <Link className="lux-button lux-button--outline" href={`/courses/${current.id}`}>Read the {current.name} guide<Icon name="arrow" /></Link>}
  </div>;
  else body = <ul className={styles.grid} aria-busy="true" aria-label="Loading colleges">
    {Array.from({ length: SHOWN }, (_, index) => <li key={index}><span className={`lux-skeleton ${styles.skeleton}`} /></li>)}
  </ul>;

  return <section id="course-colleges" className={styles.section} aria-labelledby="top-colleges-title" data-college-section data-personalised={personal || undefined}>
    <div className="container">
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}><Icon name={personal ? 'spark' : 'cap'} />{heading.eyebrow}</p>
          <h2 id="top-colleges-title" className={styles.title}>{heading.title}</h2>
          <p className={styles.lede}>{heading.lede}</p>
        </div>
        <Link className={styles.all} href={current ? `/universities?course=${current.id}` : '/universities'}>
          {current ? `All ${number.format(courseCounts[current.id] ?? 0)} ${current.name} colleges` : 'Browse the full directory'}<Icon name="arrow" />
        </Link>
      </header>
      <div className={styles.tabs} role="tablist" aria-label="Choose a course">
        {tabs.map((course, index) => {
          const selected = course.id === tabId;
          return <button key={course.id || 'for-you'} id={`top-colleges-tab-${course.id || 'for-you'}`} type="button" role="tab" className={styles.tab} data-for-you={course.id === FOR_YOU || undefined}
            aria-selected={selected} aria-controls="top-colleges-panel" tabIndex={selected ? 0 : -1}
            onClick={() => select(course.id)} onKeyDown={(event) => onTabKey(event, index)}>
            {course.id === FOR_YOU && <Icon name="spark" />}{course.name}{courseCounts[course.id] > 0 && <small>{number.format(courseCounts[course.id])}</small>}
          </button>;
        })}
      </div>
      {body}
      {ready && !personalisation && <p className={styles.personalise}>
        <Icon name="spark" />Want suggestions based on what you search?
        <button type="button" onClick={reopen}>Turn on personalised suggestions</button>
      </p>}
      {ready && personalisation && !personal && data && <p className={styles.personalise}>
        <Icon name="spark" />Search for a course or city, or open a few profiles — this list then adapts to you.
      </p>}
      <p className={styles.note}><Icon name="uniInfo" />Details come from each institution’s official website and public directories. Confirm fees and dates with the institution before applying.</p>
    </div>
  </section>;
}
