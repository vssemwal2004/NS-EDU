'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { useContent } from '@/providers/ContentProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { BandHeading } from './HomeParts';
import styles from './Home.module.css';

const VISIBLE = 8;
const number = new Intl.NumberFormat('en-IN');

// Fields come from the course catalogue; every count is the number of directory institutions that
// list the field's courses (catalogue stats), so the cards show real reach rather than sample rows.
export default function StreamBand() {
  const { courses, stats } = useCatalog();
  const { setCourse } = usePreferences();
  const fieldIcons = useContent('landing')?.fieldIcons ?? {};
  const courseCounts = useMemo(() => stats?.courseCounts ?? {}, [stats]);
  const streams = useMemo(() => {
    const fieldCounts = stats?.fieldCounts ?? {};
    const byField = new Map();
    for (const course of courses) {
      const stream = byField.get(course.field) || { field: course.field, courses: [], institutions: fieldCounts[course.field] ?? 0 };
      stream.courses.push(course);
      byField.set(course.field, stream);
    }
    // Doctorates and catch-all diplomas are offered almost everywhere but are not a subject a
    // student picks first, so they follow the subject streams.
    const generic = (field) => Number(/^(research|diplomas?\b)/i.test(field));
    return [...byField.values()]
      .map((stream) => ({ ...stream, courses: stream.courses.toSorted((a, b) => (courseCounts[b.id] ?? 0) - (courseCounts[a.id] ?? 0)) }))
      .toSorted((a, b) => generic(a.field) - generic(b.field) || b.institutions - a.institutions || a.field.localeCompare(b.field));
  }, [courses, courseCounts, stats]);
  if (!streams.length) return null;

  return <section className={styles.band} aria-labelledby="streams-title">
    <div className="container">
      <BandHeading id="streams-title" eyebrow="Study goal" icon="compass" title="Explore by stream"
        description="Pick a field, then a course — the course you choose follows you into colleges, eligibility and budget."
        href="/courses" linkLabel={`All ${streams.length} fields`} />
      <ul className={styles.streamGrid}>
        {streams.slice(0, VISIBLE).map((stream) => <li key={stream.field} className={styles.streamCard}>
          <div className={styles.streamTop}>
            <span className={styles.streamIcon}><Icon name={fieldIcons[stream.field] || stream.courses[0].icon} /></span>
            <Icon name="arrow" className={styles.streamArrow} />
          </div>
          <h3><Link className={styles.stretched} href={`/courses?field=${encodeURIComponent(stream.field)}`}>{stream.field}</Link></h3>
          <p className={styles.streamMeta}>{stream.institutions > 0
            ? <><strong>{number.format(stream.institutions)}</strong> {stream.institutions === 1 ? 'institution' : 'institutions'}</>
            : <>{stream.courses.length} {stream.courses.length === 1 ? 'course guide' : 'course guides'}</>}</p>
          <ul className={styles.streamChips} aria-label={`${stream.field} courses`}>
            {stream.courses.slice(0, 3).map((course) => <li key={course.id}>
              <Link href={`/universities?course=${course.id}`} onClick={() => setCourse(course.id)}>
                {course.name}{courseCounts[course.id] > 0 && <span className={styles.chipCount}>{number.format(courseCounts[course.id])}</span>}
              </Link>
            </li>)}
          </ul>
        </li>)}
      </ul>
    </div>
  </section>;
}
