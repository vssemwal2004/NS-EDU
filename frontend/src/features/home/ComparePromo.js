'use client';
import { useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import styles from './Home.module.css';

// Read-only view of the comparison picks saved by /compare: { [courseId]: [programmeId, …] }.
const storageKey = 'nsedu:compare';
function subscribe(onChange) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}
function getSnapshot() {
  try { return window.localStorage.getItem(storageKey); } catch { return null; }
}
const getServerSnapshot = () => null;

export default function ComparePromo() {
  const { courses, colleges } = useCatalog();
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useMemo(() => {
    let picks = {};
    try { picks = JSON.parse(stored) || {}; } catch { /* malformed storage: show the generic promo */ }
    for (const course of courses) {
      const ids = Array.isArray(picks[course.id]) ? picks[course.id] : [];
      const valid = ids.filter((id) => colleges.some((row) => row.id === id && row.courseId === course.id));
      if (valid.length >= 2) return { course, count: valid.length };
    }
    return null;
  }, [stored, courses, colleges]);
  const comparable = courses.filter((course) => colleges.filter((row) => row.courseId === course.id).length >= 2).slice(0, 6);
  if (!ready && !comparable.length) return null;

  return <section className={styles.promoBand} aria-labelledby="compare-promo-title">
    <div className="container"><div className={styles.promo}>
      <span className={styles.promoIcon}><Icon name="scales" /></span>
      <div className={styles.promoCopy}>
        <h2 id="compare-promo-title">{ready ? `${ready.count} ${ready.course.name} programmes ready to compare` : 'Compare up to 3 colleges for the same course'}</h2>
        <p>{ready ? 'Your picks are saved in this browser. Fees, salaries and demo ratings line up side by side.' : 'Same course, side by side: tuition, median and highest salary, demo rating and data years.'}</p>
      </div>
      {ready
        ? <Link className={`button button--primary ${styles.promoAction}`} href={`/compare?course=${ready.course.id}`}>Open comparison<Icon name="arrow" /></Link>
        : <ul className={styles.promoChips} aria-label="Start a comparison for" style={{ '--promo-columns': Math.min(3, comparable.length) }}>
          {comparable.map((course) => <li key={course.id}><Link className="chip" href={`/compare?course=${course.id}`}><Icon name={course.icon} />{course.name}</Link></li>)}
        </ul>}
    </div></div>
  </section>;
}
