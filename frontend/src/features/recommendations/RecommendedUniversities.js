'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import UniversityCard from '@/features/universities/UniversityCard';
import { api } from '@/lib/api/client';
import { sessionVariant } from '@/lib/session-variant';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import styles from './Recommendations.module.css';

const PERSONAL_NOTE = 'Suggested from what you searched and viewed here. Every fact on these cards comes from each institution’s own source record.';
const FALLBACK_NOTE = 'Widely searched and NIRF-ranked institutions, shown until your searches tell us more. Every fact comes from each institution’s own source record.';

/**
 * Premium recommendation rail. Loads the suggestions for the current viewer (student session or the
 * first-party visitor cookie) and renders the directory card with the reason the API derived from that
 * viewer's own events. Renders nothing when there is nothing to show.
 * Works on any page: signed in it reads /insights/recommendations; signed out it reads /insights/home,
 * which returns only the basic card details. Both rotate the default list per browser session, and
 * `course` (a course slug) limits suggestions to institutions that offer it.
 * @param {{ limit?: number, exclude?: string, course?: string, title?: string, eyebrow?: string,
 *   courseNames?: Record<string,string>, headingLevel?: 2|3, className?: string }} props
 */
export default function RecommendedUniversities({
  limit = 6, exclude = '', course = '', title = 'Picked for you', eyebrow = 'Recommendations',
  courseNames = {}, headingLevel = 2, className = '',
}) {
  const { status: auth } = useStudentAuth();
  const [state, setState] = useState({ status: 'loading', items: [], personalised: false });
  const Heading = `h${headingLevel}`;

  useEffect(() => {
    if (auth === 'loading') return undefined;
    const controller = new AbortController();
    const query = new URLSearchParams({ limit: String(limit), variant: String(sessionVariant()), ...(exclude && { exclude }), ...(course && { course }) });
    api(`/insights/${auth === 'signed-in' ? 'recommendations' : 'home'}?${query}`, { signal: controller.signal })
      .then((data) => setState({ status: 'ready', items: data.items, personalised: data.personalised }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', items: [], personalised: false }); });
    return () => controller.abort();
  }, [limit, exclude, course, auth]);

  if (state.status === 'error' || (state.status === 'ready' && !state.items.length)) return null;

  return <section className={`${styles.rail} ${className}`} aria-labelledby="recommended-title" aria-busy={state.status === 'loading'}>
    <div className={styles.head}>
      <p className="lux-eyebrow lux-eyebrow--rule">{eyebrow}</p>
      <Heading id="recommended-title" className="lux-display-3">{title}</Heading>
      <p className={styles.note}><Icon name="uniInfo" />{state.personalised ? PERSONAL_NOTE : FALLBACK_NOTE}</p>
    </div>

    {state.status === 'loading'
      ? <ul className={styles.grid}>{Array.from({ length: Math.min(limit, 3) }, (_item, index) => <li key={index}><span className={`lux-skeleton ${styles.skeleton}`} /></li>)}</ul>
      : <ul className={styles.grid}>{state.items.map((item) => <li key={item.id}>
        <p className={styles.reason} title={item.reason}><Icon name="spark" />{item.reason}</p>
        <UniversityCard item={item} courseNames={courseNames} headingLevel={headingLevel + 1} />
      </li>)}</ul>}
  </section>;
}
