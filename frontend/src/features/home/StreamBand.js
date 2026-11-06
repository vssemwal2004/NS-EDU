'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { useContent } from '@/providers/ContentProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { BandHeading } from './HomeParts';
import { StreamScene, themeFor } from './streamThemes';
import home from './Home.module.css';
import styles from './StreamBand.module.css';

const VISIBLE = 8;
const number = new Intl.NumberFormat('en-IN');

// Fields come from the course catalogue; every count is the number of directory institutions that
// list the field's courses (catalogue stats), so the cards show real reach rather than sample rows.
// Each card has its field's own scene (colour, texture, line-art of the field's tools) and a reach
// bar: the field's institutions relative to the most widely offered field.
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
  const shown = streams.slice(0, VISIBLE);
  const most = Math.max(1, ...shown.map((stream) => stream.institutions));

  return <section className={home.band} aria-labelledby="streams-title">
    <div className="container">
      <BandHeading id="streams-title" eyebrow="Study goal" icon="compass" title="Explore by stream"
        description="Pick a field, then a course — the course you choose follows you into colleges, eligibility and budget."
        href="/courses" linkLabel={`All ${streams.length} fields`} />
      <ul className={styles.grid}>
        {shown.map((stream, index) => {
          const theme = themeFor(stream.field);
          const share = Math.round((stream.institutions / most) * 100);
          return <li key={stream.field} className={styles.card} data-texture={theme.texture}
            style={{ '--stream-from': theme.from, '--stream-to': theme.to, '--stream-delay': `${index * 60}ms` }}>
            <div className={styles.scene}>
              <StreamScene scene={theme.scene} className={styles.art} />
              <span className={styles.rank} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.badge}><Icon name={fieldIcons[stream.field] || stream.courses[0].icon} /></span>
            </div>
            <div className={styles.body}>
              <h3 className={styles.title}><Link className={styles.stretched} href={`/courses?field=${encodeURIComponent(stream.field)}`}>{stream.field}</Link></h3>
              {stream.institutions > 0 ? <>
                <p className={styles.meta}><strong>{number.format(stream.institutions)}</strong> {stream.institutions === 1 ? 'institution' : 'institutions'}</p>
                <div className={styles.reach} role="img" aria-label={`${share}% of the reach of the most widely offered field`}>
                  <span style={{ '--share': `${Math.max(share, 4)}%` }} />
                </div>
              </> : <p className={styles.meta}>{stream.courses.length} {stream.courses.length === 1 ? 'course guide' : 'course guides'}</p>}
              <ul className={styles.chips} aria-label={`${stream.field} courses`}>
                {stream.courses.slice(0, 3).map((course) => <li key={course.id}>
                  <Link href={`/universities?course=${course.id}`} onClick={() => setCourse(course.id)}>
                    {course.name}{courseCounts[course.id] > 0 && <span className={styles.chipCount}>{number.format(courseCounts[course.id])}</span>}
                  </Link>
                </li>)}
              </ul>
              <span className={styles.explore} aria-hidden="true">Explore {stream.field}<Icon name="arrow" /></span>
            </div>
          </li>;
        })}
      </ul>
    </div>
  </section>;
}
